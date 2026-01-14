import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { prisma } from '@textile/database';
import { GstCalculatorService } from './services/gst-calculator.service';
import { InvoiceGeneratorService } from './services/invoice-generator.service';
import { CreateInvoiceDto, UpdateInvoiceDto, InvoiceFiltersDto, CancelInvoiceDto, GenerateEwayBillDto, CreateDebitNoteDto, CreateCreditNoteDto } from './dto';
import { InvoiceType, Prisma } from '@textile/database';
import { EWayBillService } from './services/eway-bill.service';
import { constants } from '@textile/shared';
import { RedisService } from '../../common/redis/redis.service';
import { VouchersService } from '../vouchers/vouchers.service';
import { LedgerSetupService } from '../vouchers/services/ledger-setup.service';
import { ProductBatchesService } from '../products/product-batches.service';
@Injectable()
export class InvoicesService {
    constructor(
        private prisma: prisma.PrismaService,
        private gstCalculator: GstCalculatorService,
        private invoiceGenerator: InvoiceGeneratorService,
        private ewayBillService: EWayBillService,
        private redisService: RedisService,
        private vouchersService: VouchersService,
        private ledgerSetupService: LedgerSetupService,
        private productBatchesService: ProductBatchesService
    ) { }


    async create(organizationId: string, dto: CreateInvoiceDto, userId: string) {
        const party = await this.prisma.party.findFirst({
            where: { id: dto.partyId, organizationId },
        });

        if (!party) {
            throw new NotFoundException('Party not found');
        }

        const organization = await this.prisma.organization.findUnique({
            where: { id: organizationId },
        });

        if (!organization) {
            throw new NotFoundException('Organization not found');
        }

        const deliveryState = dto.deliveryState || party.state || organization.state;
        const isInterstate = this.gstCalculator.isInterstate(organization.state, deliveryState);

        if (dto.deliveryState && party.state && dto.deliveryState !== party.state) {
            console.warn(
                `Invoice for ${party.businessName}: Delivery state (${dto.deliveryState}) differs from party state (${party.state}). Using delivery state for GST.`
            );
        }

        const calculations = await this.calculateInvoiceTotals(
            dto.items,
            dto.discountPercentage || 0,
            dto.discountAmount || 0,
            isInterstate,
            organizationId,
        );

        try {
            const invoice = await this.prisma.$transaction(async (tx) => {
                const org = await tx.organization.update({
                    where: { id: organizationId },
                    data: { invoiceCounter: { increment: 1 } },
                    select: { invoiceCounter: true, invoicePrefix: true }
                });

                const invoiceNumber = this.invoiceGenerator.generateInvoiceNumber(
                    org.invoicePrefix,
                    org.invoiceCounter,
                    new Date(dto.invoiceDate || new Date()),
                );

                const newInvoice = await tx.invoice.create({
                    data: {
                        organizationId,
                        invoiceType: dto.invoiceType as InvoiceType,
                        invoiceNumber,
                        invoiceDate: dto.invoiceDate ? new Date(dto.invoiceDate) : new Date(),
                        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
                        partyId: dto.partyId,
                        partyName: party.businessName,
                        partyGstin: party.gstin,
                        partyState: party.state,
                        deliveryAddressLine1: dto.deliveryAddressLine1 || party.addressLine1,
                        deliveryAddressLine2: dto.deliveryAddressLine2 || party.addressLine2,
                        deliveryCity: dto.deliveryCity || party.city,
                        deliveryState: deliveryState,
                        deliveryPincode: dto.deliveryPincode || party.pincode,
                        subtotal: calculations.subtotal,
                        discountAmount: calculations.discountAmount,
                        discountPercentage: dto.discountPercentage || 0,
                        cgstAmount: calculations.cgstAmount,
                        sgstAmount: calculations.sgstAmount,
                        igstAmount: calculations.igstAmount,
                        cessAmount: 0,
                        tcsAmount: calculations.tcsAmount,
                        tcsPercentage: calculations.tcsPercentage,
                        roundOff: calculations.roundOff,
                        totalAmount: calculations.totalAmount,
                        balanceAmount: calculations.totalAmount,
                        placeOfSupply: deliveryState,
                        reverseCharge: dto.reverseCharge || false,
                        notes: dto.notes,
                        termsAndConditions: dto.termsAndConditions,
                        createdBy: userId,
                    },
                });

                // CREATE INVOICE ITEMS
                const itemsWithIndex = calculations.items.map((item, index) => ({ ...item, index }));

                const createdItems = await Promise.all(
                    itemsWithIndex.map(async (item) => {
                        const createdItem = await tx.invoiceItem.create({
                            data: {
                                invoiceId: newInvoice.id,
                                organizationId,
                                productId: item.productId,
                                productName: item.productName,
                                productCode: item.productCode,
                                hsnCode: item.hsnCode,
                                quantity: item.quantity,
                                unit: item.unit,
                                rate: item.rate,
                                discountPercentage: item.discountPercentage,
                                discountAmount: item.discountAmount,
                                taxableAmount: item.taxableAmount,
                                gstRate: item.gstRate,
                                cgstRate: item.cgstRate,
                                sgstRate: item.sgstRate,
                                igstRate: item.igstRate,
                                cessRate: item.cessRate,
                                cgstAmount: item.cgstAmount,
                                sgstAmount: item.sgstAmount,
                                igstAmount: item.igstAmount,
                                cessAmount: item.cessAmount,
                                totalAmount: item.totalAmount,
                                costPrice: null,
                                cogsAmount: null,
                                profitAmount: null,
                                profitMargin: null,
                            },
                        });
                        return { ...createdItem, originalIndex: item.index };
                    })
                );

                // HANDLE SALE INVOICES WITH COGS
                if (dto.invoiceType === 'sale') {
                    for (let i = 0; i < dto.items.length; i++) {
                        const dtoItem = dto.items[i];
                        const createdItem = createdItems[i];

                        if (!dtoItem.productId) continue;

                        const product = await tx.product.findUnique({
                            where: { id: dtoItem.productId, organizationId },
                        });

                        if (!product) {
                            throw new NotFoundException(`Product not found: ${dtoItem.productId}`);
                        }

                        const stockBefore = Number(product.currentStock);

                        let allocations: Array<{ batchId: string; quantity: number; costPrice: number }> = [];
                        let totalCOGS = 0;
                        let averageCostPrice = 0;

                        const batchCount = await tx.productBatch.count({
                            where: {
                                organizationId,
                                productId: dtoItem.productId,
                                currentStock: { gt: 0 },
                                isActive: true,
                                deletedAt: null,
                            },
                        });

                        if (batchCount > 0) {
                            try {
                                allocations = await this.productBatchesService.allocateStock(
                                    tx,
                                    organizationId,
                                    dtoItem.productId,
                                    dtoItem.quantity,
                                );

                                totalCOGS = allocations.reduce(
                                    (sum, alloc) => sum + alloc.quantity * alloc.costPrice,
                                    0
                                );
                                averageCostPrice = totalCOGS / dtoItem.quantity;

                                console.log(
                                    `✅ FIFO Allocation for ${product.productName}:\n` +
                                    allocations.map(a =>
                                        `   Batch ${a.batchId.slice(0, 8)}: ${a.quantity} units @ ₹${a.costPrice} = ₹${(a.quantity * a.costPrice).toFixed(2)}`
                                    ).join('\n') +
                                    `\n   Total COGS: ₹${totalCOGS.toFixed(2)}\n   Avg Cost: ₹${averageCostPrice.toFixed(2)}/unit`
                                );
                            } catch (error) {
                                console.warn('Failed to allocate stock:', error);
                                throw new BadRequestException('Failed to allocate stock');
                            }
                        } else {
                            console.warn(`⚠️ No batch found for ${product.productName}, using product purchase price`);
                            averageCostPrice = Number(product.purchasePrice || product.basePrice);
                            totalCOGS = dtoItem.quantity * averageCostPrice;
                        }

                        // UPDATE WITH COGS DATA
                        const saleAmount = Number(createdItem.totalAmount);
                        const profitAmount = saleAmount - totalCOGS;
                        const profitMargin = saleAmount > 0 ? (profitAmount / saleAmount) * 100 : 0;

                        await tx.invoiceItem.update({
                            where: { id: createdItem.id },
                            data: {
                                costPrice: Math.round(averageCostPrice * 100) / 100,
                                cogsAmount: Math.round(totalCOGS * 100) / 100,
                                profitAmount: Math.round(profitAmount * 100) / 100,
                                profitMargin: Math.round(profitMargin * 100) / 100,
                            },
                        });

                        console.log(
                            `💰 Profit Analysis for ${product.productName}:\n` +
                            `   Sale Price: ₹${saleAmount.toFixed(2)}\n` +
                            `   COGS: ₹${totalCOGS.toFixed(2)}\n` +
                            `   Profit: ₹${profitAmount.toFixed(2)} (${profitMargin.toFixed(2)}%)`
                        );

                        const newStock = stockBefore - dtoItem.quantity;

                        if (newStock < 0) {
                            throw new BadRequestException(
                                `Insufficient stock for "${product.productName}". Available: ${stockBefore}, Required: ${dtoItem.quantity}`
                            );
                        }

                        await tx.product.update({
                            where: { id: dtoItem.productId },
                            data: { currentStock: newStock },
                        });

                        const batchInfo = allocations.length > 0
                            ? `FIFO batches: ${allocations.map(a => a.batchId.slice(0, 8)).join(', ')}`
                            : 'No batch tracking';

                        await tx.inventoryTransaction.create({
                            data: {
                                organizationId,
                                productId: dtoItem.productId,
                                transactionType: 'sale',
                                quantity: dtoItem.quantity,
                                unit: product.unit,
                                stockBefore,
                                stockAfter: newStock,
                                transactionDate: new Date(),
                                referenceType: 'invoice',
                                referenceId: newInvoice.id,
                                referenceNumber: invoiceNumber,
                                notes: `Sale via Invoice #${invoiceNumber} (${batchInfo}). COGS: ₹${totalCOGS.toFixed(2)}, Profit: ₹${profitAmount.toFixed(2)}`,
                                createdBy: userId,
                            },
                        });
                    }
                }
                // HANDLE PURCHASE INVOICES (unchanged)
                else if (dto.invoiceType === 'purchase') {
                    await Promise.all(
                        dto.items.map(async (item) => {
                            if (item.productId) {
                                const product = await tx.product.findUnique({
                                    where: { id: item.productId, organizationId },
                                });

                                if (!product) {
                                    throw new NotFoundException(`Product not found: ${item.productId}`);
                                }

                                const stockBefore = Number(product.currentStock);
                                const newStock = stockBefore + item.quantity;
                                const batchNumber = `${invoiceNumber}-${item.productCode || product.productCode}`;

                                await tx.productBatch.create({
                                    data: {
                                        organizationId,
                                        productId: item.productId,
                                        batchNumber,
                                        purchaseInvoiceId: newInvoice.id,
                                        purchaseDate: new Date(dto.invoiceDate || new Date()),
                                        purchasePrice: item.rate,
                                        openingStock: item.quantity,
                                        currentStock: item.quantity,
                                        godownLocation: dto.godownLocation,
                                        thaan: item.thaan,
                                        designNumber: item.designNumber || product.designNumber,
                                        color: item.color,
                                        lotNumber: item.lotNumber,
                                        notes: `Auto-created from Purchase Invoice ${invoiceNumber}`,
                                    },
                                });

                                console.log(`✅ Batch created: ${batchNumber} (${item.quantity} ${product.unit} @ ₹${item.rate})`);

                                await tx.product.update({
                                    where: { id: item.productId },
                                    data: {
                                        currentStock: newStock,
                                        purchasePrice: item.rate,
                                    },
                                });

                                await tx.inventoryTransaction.create({
                                    data: {
                                        organizationId,
                                        productId: item.productId,
                                        transactionType: 'purchase',
                                        quantity: item.quantity,
                                        unit: product.unit,
                                        stockBefore,
                                        stockAfter: newStock,
                                        transactionDate: new Date(),
                                        referenceType: 'invoice',
                                        referenceId: newInvoice.id,
                                        referenceNumber: invoiceNumber,
                                        notes: `Purchase via Invoice #${invoiceNumber} - Batch: ${batchNumber}`,
                                        createdBy: userId,
                                    },
                                });
                            }
                        }),
                    );
                }

                await this.createInvoiceVoucher(
                    tx, organizationId, newInvoice, party, isInterstate, userId
                );

                return newInvoice;
            });

            return this.findById(organizationId, invoice.id);

        } catch (error: any) {
            console.error(error);
            if (error instanceof BadRequestException || error instanceof NotFoundException) {
                throw error;
            }

            throw new BadRequestException(
                `Failed to create invoice: ${error.message || 'Unknown error occurred'}`
            );
        }
    }

    /**
     * Calculate all invoice totals
     */
    private async calculateInvoiceTotals(
        items: CreateInvoiceDto['items'],
        discountPercentage: number,
        discountAmount: number,
        isInterstate: boolean,
        organizationId: string,
    ) {
        let subtotal = 0;
        let totalCGST = 0;
        let totalSGST = 0;
        let totalIGST = 0;

        const calculatedItems = await Promise.all(
            items.map(async (item) => {
                // Get product if ID provided
                let product = null;
                if (item.productId) {
                    product = await this.prisma.product.findFirst({
                        where: { id: item.productId, organizationId },
                    });
                }

                // Calculate item amounts
                const itemTotal = item.quantity * item.rate;
                const itemDiscount = (itemTotal * (item.discountPercentage || 0)) / 100;
                const taxableAmount = this.gstCalculator.roundOff(itemTotal - itemDiscount);

                // Calculate GST
                const gst = this.gstCalculator.calculateGST(taxableAmount, item.gstRate, isInterstate);

                const itemTotalAmount = taxableAmount + gst.totalGST;

                subtotal += itemTotal;
                totalCGST += gst.cgstAmount;
                totalSGST += gst.sgstAmount;
                totalIGST += gst.igstAmount;

                return {
                    productId: item.productId,
                    productName: item.productName,
                    productCode: item.productCode || product?.productCode,
                    hsnCode: item.hsnCode,
                    quantity: item.quantity,
                    unit: item.unit,
                    rate: item.rate,
                    discountPercentage: item.discountPercentage || 0,
                    discountAmount: itemDiscount,
                    taxableAmount,
                    gstRate: item.gstRate,
                    cgstRate: gst.cgstAmount > 0 ? item.gstRate / 2 : 0,
                    sgstRate: gst.sgstAmount > 0 ? item.gstRate / 2 : 0,
                    igstRate: gst.igstAmount > 0 ? item.gstRate : 0,
                    cessRate: 0,
                    cgstAmount: gst.cgstAmount,
                    sgstAmount: gst.sgstAmount,
                    igstAmount: gst.igstAmount,
                    cessAmount: 0,
                    totalAmount: itemTotalAmount,
                };
            }),
        );

        // Apply invoice-level discount
        const invoiceDiscount = discountAmount || (subtotal * discountPercentage) / 100;
        const subtotalAfterDiscount = subtotal - invoiceDiscount;

        // Calculate TCS
        const tcs = this.gstCalculator.calculateTCS(subtotalAfterDiscount + totalCGST + totalSGST + totalIGST);

        // Calculate final total
        const totalBeforeRoundOff = subtotalAfterDiscount + totalCGST + totalSGST + totalIGST + tcs.tcsAmount;
        const roundOff = this.gstCalculator.calculateRoundOff(totalBeforeRoundOff);
        const totalAmount = Math.round(totalBeforeRoundOff);

        return {
            items: calculatedItems,
            subtotal: this.gstCalculator.roundOff(subtotal),
            discountAmount: this.gstCalculator.roundOff(invoiceDiscount),
            cgstAmount: this.gstCalculator.roundOff(totalCGST),
            sgstAmount: this.gstCalculator.roundOff(totalSGST),
            igstAmount: this.gstCalculator.roundOff(totalIGST),
            tcsAmount: tcs.tcsAmount,
            tcsPercentage: tcs.tcsPercentage,
            roundOff,
            totalAmount,
        };
    }


    async findAll(organizationId: string, filters: InvoiceFiltersDto) {
        const { page = 1, limit = 20, sortBy = 'invoiceDate', sortOrder = 'DESC' } = filters;

        const where: Prisma.InvoiceWhereInput = {
            organizationId,
            deletedAt: null,
        };

        if (filters.invoiceType) {
            where.invoiceType = filters.invoiceType as InvoiceType;
        }

        if (filters.partyId) {
            where.partyId = filters.partyId;
        }

        if (filters.startDate || filters.endDate) {
            where.invoiceDate = {};
            if (filters.startDate) {
                where.invoiceDate.gte = new Date(filters.startDate);
            }
            if (filters.endDate) {
                where.invoiceDate.lte = new Date(filters.endDate);
            }
        }

        if (filters.status) {
            if (filters.status === 'paid') {
                where.balanceAmount = 0;
            } else if (filters.status === 'unpaid') {
                where.balanceAmount = { gt: 0 };
                where.paidAmount = 0;
            } else if (filters.status === 'partial') {
                where.balanceAmount = { gt: 0 };
                where.paidAmount = { gt: 0 };
            }
        }

        const [data, total] = await Promise.all([
            this.prisma.invoice.findMany({
                where,
                include: {
                    party: { select: { businessName: true, phone: true } },
                    items: true,
                },
                orderBy: { [sortBy]: sortOrder.toLowerCase() },
                skip: (page - 1) * limit,
                take: limit,
            }),
            this.prisma.invoice.count({ where }),
        ]);

        return {
            data,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
    }

    /**
     * Get invoice by ID
     */
    async findById(organizationId: string, id: string) {
        const invoice = await this.prisma.invoice.findFirst({
            where: { id, organizationId, deletedAt: null },
            include: {
                party: true,
                items: true,
                payments: true,
            },
        });

        if (!invoice) {
            throw new NotFoundException('Invoice not found');
        }

        return invoice;
    }

    /**
     * Update invoice (only if not paid)
     */
    async update(organizationId: string, id: string, dto: UpdateInvoiceDto) {
        const invoice = await this.findById(organizationId, id);

        if (Number(invoice.paidAmount) > 0) {
            throw new BadRequestException('Cannot update invoice with payments');
        }

        if (invoice.isCancelled) {
            throw new BadRequestException('Cannot update cancelled invoice');
        }

        return this.prisma.invoice.update({
            where: { id },
            data: {
                invoiceDate: dto.invoiceDate ? new Date(dto.invoiceDate) : undefined,
                dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
                notes: dto.notes,
                termsAndConditions: dto.termsAndConditions,
            },
            include: {
                party: true,
                items: true,
            },
        });
    }
    async cancel(organizationId: string, id: string, dto: CancelInvoiceDto, userId: string) {
        const invoice = await this.findById(organizationId, id);

        if (invoice.isCancelled) {
            throw new BadRequestException('Invoice already cancelled');
        }

        if (Number(invoice.paidAmount) > 0) {
            throw new BadRequestException('Cannot cancel invoice with payments. Please reverse payments first.');
        }

        await this.prisma.$transaction(async (tx) => {
            const voucher = await tx.voucher.findFirst({
                where: {
                    organizationId,
                    referenceType: 'invoice',
                    referenceId: invoice.id,
                    deletedAt: null,
                },
                include: {
                    entries: true,
                },
            });

            if (voucher && !voucher.isCancelled) {

                for (const entry of voucher.entries) {
                    const debit = Number(entry.debitAmount);
                    const credit = Number(entry.creditAmount);

                    if (debit > 0) {
                        await tx.ledger.update({
                            where: { id: entry.ledgerId },
                            data: {
                                currentBalance: {
                                    decrement: debit,
                                },
                            },
                        });
                    } else if (credit > 0) {
                        await tx.ledger.update({
                            where: { id: entry.ledgerId },
                            data: {
                                currentBalance: {
                                    increment: credit,
                                },
                            },
                        });
                    }
                }


                await tx.voucher.update({
                    where: { id: voucher.id },
                    data: {
                        isCancelled: true,
                        cancelledAt: new Date(),
                        cancelledBy: userId,
                        cancellationReason: dto.reason,
                    },
                });
            }


            if (invoice.invoiceType === 'sale') {
                const items = await tx.invoiceItem.findMany({
                    where: { invoiceId: invoice.id },
                });

                for (const item of items) {
                    if (item.productId) {
                        const product = await tx.product.findUnique({
                            where: { id: item.productId },
                        });

                        if (product) {
                            const stockBefore = Number(product.currentStock);
                            const newStock = stockBefore + Number(item.quantity);

                            await tx.product.update({
                                where: { id: item.productId },
                                data: { currentStock: newStock },
                            });

                            await tx.inventoryTransaction.create({
                                data: {
                                    organizationId,
                                    productId: item.productId,
                                    transactionType: 'sale_return',
                                    quantity: Number(item.quantity),
                                    unit: product.unit,
                                    stockBefore,
                                    stockAfter: newStock,
                                    transactionDate: new Date(),
                                    referenceType: 'invoice_cancellation',
                                    referenceId: invoice.id,
                                    notes: `Stock restored - Invoice ${invoice.invoiceNumber} cancelled: ${dto.reason}`,
                                },
                            });
                        }
                    }
                }
            }

            await tx.invoice.update({
                where: { id },
                data: {
                    isCancelled: true,
                    cancelledAt: new Date(),
                    cancelledBy: userId,
                    cancellationReason: dto.reason,
                },
            });
        });

        return this.findById(organizationId, id);
    }
    /**
     * Delete invoice (soft delete)
     */
    async remove(organizationId: string, id: string) {
        const invoice = await this.findById(organizationId, id);

        if (Number(invoice.paidAmount) > 0) {
            throw new BadRequestException('Cannot delete invoice with payments');
        }

        await this.prisma.$transaction(async (tx) => {

            const voucher = await tx.voucher.findFirst({
                where: {
                    organizationId,
                    referenceType: 'invoice',
                    referenceId: invoice.id,
                    deletedAt: null,
                },
                include: {
                    entries: true,
                },
            });

            if (voucher && !voucher.isCancelled) {
                // Reverse all ledger balances
                for (const entry of voucher.entries) {
                    const debit = Number(entry.debitAmount);
                    const credit = Number(entry.creditAmount);

                    if (debit > 0) {
                        await tx.ledger.update({
                            where: { id: entry.ledgerId },
                            data: {
                                currentBalance: {
                                    decrement: debit,
                                },
                            },
                        });
                    } else if (credit > 0) {
                        await tx.ledger.update({
                            where: { id: entry.ledgerId },
                            data: {
                                currentBalance: {
                                    increment: credit,
                                },
                            },
                        });
                    }
                }

                await tx.voucher.update({
                    where: { id: voucher.id },
                    data: {
                        isCancelled: true,
                        cancelledAt: new Date(),
                        cancellationReason: 'Invoice deleted',
                        deletedAt: new Date(),
                    }
                })
            }
            if (invoice.invoiceType === 'sale') {
                const items = await tx.invoiceItem.findMany({
                    where: { invoiceId: invoice.id },
                });

                for (const item of items) {
                    if (item.productId) {
                        const product = await tx.product.findUnique({
                            where: { id: item.productId },
                        });

                        if (product) {
                            const stockBefore = Number(product.currentStock);
                            const newStock = stockBefore + Number(item.quantity);

                            await tx.product.update({
                                where: { id: item.productId },
                                data: { currentStock: newStock },
                            });

                            await tx.inventoryTransaction.create({
                                data: {
                                    organizationId,
                                    productId: item.productId,
                                    transactionType: 'sale_return',
                                    quantity: Number(item.quantity),
                                    unit: product.unit,
                                    stockBefore,
                                    stockAfter: newStock,
                                    transactionDate: new Date(),
                                    referenceType: 'invoice_deletion',
                                    referenceId: invoice.id,
                                    notes: `Stock restored - Invoice ${invoice.invoiceNumber} deleted`,
                                },
                            });
                        }
                    }
                }
            } else if (invoice.invoiceType === 'purchase') {
                const items = await tx.invoiceItem.findMany({
                    where: { invoiceId: invoice.id },
                });

                for (const item of items) {
                    if (item.productId) {
                        const product = await tx.product.findUnique({
                            where: { id: item.productId },
                        });

                        if (product) {
                            const stockBefore = Number(product.currentStock);
                            const newStock = stockBefore - Number(item.quantity);

                            if (newStock < 0) {
                                throw new BadRequestException(
                                    `Cannot delete purchase invoice. Stock for "${product.productName}" would become negative.`
                                );
                            }

                            await tx.product.update({
                                where: { id: item.productId },
                                data: { currentStock: newStock },
                            });

                            await tx.inventoryTransaction.create({
                                data: {
                                    organizationId,
                                    productId: item.productId,
                                    transactionType: 'purchase_return',
                                    quantity: Number(item.quantity),
                                    unit: product.unit,
                                    stockBefore,
                                    stockAfter: newStock,
                                    transactionDate: new Date(),
                                    referenceType: 'invoice_deletion',
                                    referenceId: invoice.id,
                                    notes: `Stock reversed - Purchase Invoice ${invoice.invoiceNumber} deleted`,
                                },
                            });
                        }
                    }
                }
            }



            const deletedBatches = await tx.productBatch.deleteMany({
                where: {
                    purchaseInvoiceId: invoice.id
                }
            })

            console.log(`✅ Deleted ${deletedBatches.count} batches for purchase invoice ${invoice.invoiceNumber}`);

            await tx.invoice.update({
                where: { id },
                data: { deletedAt: new Date() },
            });

        });

        return { success: true, message: 'Invoice deleted successfully' };

    }



    async generateEWayBill(organizationId: string, dto: GenerateEwayBillDto, userId: string) {


        const { invoiceId, transport } = dto;

        const invoice = await this.prisma.invoice.findFirst({
            where: {
                id: invoiceId,
                organizationId,
                deletedAt: null,
                isCancelled: false,
            },
            include: {
                items: true,
                party: true,
                organization: {
                    select: {
                        gstin: true,
                        businessName: true,
                        addressLine1: true,
                        addressLine2: true,
                        city: true,
                        state: true,
                        pincode: true,
                    },
                }
            }
        });

        if (!invoice) {
            throw new NotFoundException('Invoice not found');
        }

        const EWAY_BILL_MIN_INVOICE_AMOUNT = 50000;

        if (Number(invoice.totalAmount) < EWAY_BILL_MIN_INVOICE_AMOUNT) {
            throw new BadRequestException('E-Way Bill not required for invoices below ₹50,000');
        }

        const isInterstate = this.gstCalculator.isInterstate(
            invoice.organization.state,
            invoice.party.state || invoice.organization.state,
        );

        const invoiceDate = new Date(invoice.invoiceDate);
        const docDate = invoiceDate.toLocaleDateString('en-IN');
        // DD/MM/YYYY 

        const ewbPayload = {
            docType: 'INV', // You can extend later for other types
            docNo: invoice.invoiceNumber,
            docDate,

            fromGstin: invoice.organization.gstin || '',
            fromTradeName: invoice.organization.businessName,
            fromAddr1: invoice.organization.addressLine1 || '',
            fromPincode: invoice.organization.pincode,
            fromStateCode: constants.STATE_CODES[invoice.organization.state],

            toGstin: invoice.party.gstin || 'URP', // URP = Unregistered Party
            toTradeName: invoice.party.businessName,
            toAddr1: invoice.party.addressLine1 || '',
            toPincode: invoice.party.pincode || '999999',
            toStateCode: invoice.party.state ? constants.STATE_CODES[invoice.party.state] : constants.STATE_CODES[invoice.organization.state],

            transportMode: transport?.transportMode || '1', // Default Road
            distance: transport?.distance ?? 0, // 0 = auto-calculate
            vehicleNumber: transport?.vehicleNumber,
            transporterId: transport?.transporterId,
            transporterDocNumber: transport?.transporterDocNumber,
            transporterDocDate: transport?.transporterDocDate,

            items: invoice.items.map(item => ({
                hsn: item.hsnCode,
                productName: item.productName,
                quantity: Number(item.quantity),
                unit: item.unit.toUpperCase(), // NIC expects uppercase: PCS, KGS, etc.
                taxableAmount: Number(item.taxableAmount),
                cgst: isInterstate ? 0 : Number(item.cgstAmount),
                sgst: isInterstate ? 0 : Number(item.sgstAmount),
                igst: isInterstate ? Number(item.igstAmount) : 0,
            })),
        };

        const userContext = {
            gstin: invoice.organization.gstin, userId
        }

        const ewbResponse = await this.ewayBillService.generateEwb(ewbPayload, userContext);

        if (ewbResponse?.ewayBillNo || ewbResponse?.ewbNo) {
            const ewayBillNo = ewbResponse.ewayBillNo || ewbResponse.ewbNo;

            await this.prisma.invoice.update({
                where: { id: invoiceId },
                data: {
                    ewayBillNumber: ewayBillNo,
                    ewayBillDate: new Date(),
                    vehicleNumber: transport?.vehicleNumber,
                    transporterId: transport?.transporterId,
                    distance: transport?.distance,
                    transportMode: transport?.transportMode,
                    transporterDocNumber: transport?.transporterDocNumber,
                    transporterDocDate: transport?.transporterDocDate ? new Date(transport.transporterDocDate.split('/').reverse().join('-')) : null,
                },
            });
        }

        return ewbResponse;
    }

    async getEwayBillDetails(ewbNo: string) {
        const ewbDetails = await this.ewayBillService.getEwb(ewbNo);

        if (ewbDetails) {
            return {
                success: true,
                source: 'mock-local',
                data: ewbDetails,
            };
        }

        throw new NotFoundException(`E-Way Bill ${ewbNo} not found`);
    }

    private async createCreditNoteVoucher(
        tx: any,
        organizationId: string,
        creditNote: any,
        originalInvoice: any,
        calculations: any,
        tcsReversal: any, // ✅ ADD THIS PARAMETER
        isInterstate: boolean,
        userId: string,
    ) {
        const party = await tx.party.findUnique({
            where: { id: creditNote.partyId },
            include: { ledger: true },
        });

        if (!party || !party.ledger) {
            throw new BadRequestException('Party ledger not found');
        }

        const salesReturnLedger = await this.ledgerSetupService.getSystemLedger(
            organizationId,
            'Sales Return',
        );

        const cgstLedger = await this.ledgerSetupService.getSystemLedger(
            organizationId,
            'CGST Output',
        );

        const sgstLedger = await this.ledgerSetupService.getSystemLedger(
            organizationId,
            'SGST Output',
        );

        const igstLedger = await this.ledgerSetupService.getSystemLedger(
            organizationId,
            'IGST Output',
        );

        const roundOffLedger = await this.ledgerSetupService.getSystemLedger(
            organizationId,
            'Round Off',
        );

        if (!salesReturnLedger || !cgstLedger || !sgstLedger || !igstLedger || !roundOffLedger) {
            throw new BadRequestException('Required system ledgers not found');
        }

        const entries: any[] = [];

        // Dr. Sales Return
        entries.push({
            ledgerId: salesReturnLedger.id,
            ledgerName: salesReturnLedger.ledgerName,
            debitAmount: calculations.subtotal - calculations.discountAmount,
            creditAmount: 0,
        });

        // Dr. GST Output (✅ matches original invoice's GST type)
        if (isInterstate) {
            if (Number(creditNote.igstAmount) > 0) {
                entries.push({
                    ledgerId: igstLedger.id,
                    ledgerName: igstLedger.ledgerName,
                    debitAmount: Number(creditNote.igstAmount),
                    creditAmount: 0,
                });
            }
        } else {
            if (Number(creditNote.cgstAmount) > 0) {
                entries.push({
                    ledgerId: cgstLedger.id,
                    ledgerName: cgstLedger.ledgerName,
                    debitAmount: Number(creditNote.cgstAmount),
                    creditAmount: 0,
                });
            }
            if (Number(creditNote.sgstAmount) > 0) {
                entries.push({
                    ledgerId: sgstLedger.id,
                    ledgerName: sgstLedger.ledgerName,
                    debitAmount: Number(creditNote.sgstAmount),
                    creditAmount: 0,
                });
            }
        }

        // ✅ NEW: Dr. TCS Payable (reverse TCS)
        if (tcsReversal.tcsAmount > 0) {
            const tcsLedger = await this.ledgerSetupService.getSystemLedger(
                organizationId,
                'TCS Payable',
            );

            if (tcsLedger) {
                entries.push({
                    ledgerId: tcsLedger.id,
                    ledgerName: tcsLedger.ledgerName,
                    debitAmount: tcsReversal.tcsAmount,
                    creditAmount: 0,
                });
            }
        }

        // Round Off
        if (Number(creditNote.roundOff) !== 0) {
            const roundOffAmount = Math.abs(Number(creditNote.roundOff));
            entries.push({
                ledgerId: roundOffLedger.id,
                ledgerName: roundOffLedger.ledgerName,
                debitAmount: Number(creditNote.roundOff) < 0 ? roundOffAmount : 0,
                creditAmount: Number(creditNote.roundOff) > 0 ? roundOffAmount : 0,
            });
        }

        // Cr. Party
        entries.push({
            ledgerId: party.ledger.id,
            ledgerName: party.ledger.ledgerName,
            debitAmount: 0,
            creditAmount: Number(creditNote.totalAmount),
        });

        const voucherNumber = `CN-${creditNote.invoiceNumber}`;

        const totalDebit = entries.reduce((sum, e) => sum + Number(e.debitAmount), 0);
        const totalCredit = entries.reduce((sum, e) => sum + Number(e.creditAmount), 0);

        const voucher = await tx.voucher.create({
            data: {
                organizationId,
                voucherType: 'credit_note',
                voucherNumber,
                voucherDate: creditNote.invoiceDate,
                narration: `Credit Note ${creditNote.invoiceNumber} for Invoice ${originalInvoice.invoiceNumber}. Reason: ${creditNote.returnReason}`,
                referenceType: 'credit_note',
                referenceId: creditNote.id,
                referenceNumber: creditNote.invoiceNumber,
                totalDebit: Math.round(totalDebit * 100) / 100,
                totalCredit: Math.round(totalCredit * 100) / 100,
                isPosted: true,
                createdBy: userId,
            },
        });

        for (const entry of entries) {
            await tx.voucherEntry.create({
                data: {
                    voucherId: voucher.id,
                    ledgerId: entry.ledgerId,
                    ledgerName: entry.ledgerName,
                    debitAmount: entry.debitAmount,
                    creditAmount: entry.creditAmount,
                },
            });

            if (Number(entry.debitAmount) > 0) {
                await tx.ledger.update({
                    where: { id: entry.ledgerId },
                    data: { currentBalance: { increment: entry.debitAmount } },
                });
            } else if (Number(entry.creditAmount) > 0) {
                await tx.ledger.update({
                    where: { id: entry.ledgerId },
                    data: { currentBalance: { decrement: entry.creditAmount } },
                });
            }
        }
    }

    private calculateTCSReversal(originalInvoice: any, returnTaxableAmount: number) {
        const originalTCS = Number(originalInvoice.tcsAmount);
        const originalTaxable = Number(originalInvoice.subtotal) - Number(originalInvoice.discountAmount);

        if (originalTCS === 0 || originalTaxable === 0) {
            return { tcsAmount: 0, tcsPercentage: 0 };
        }

        // Calculate proportional TCS
        const tcsPercentage = Number(originalInvoice.tcsPercentage);
        const tcsAmount = this.gstCalculator.roundOff((returnTaxableAmount * tcsPercentage) / 100);

        return {
            tcsAmount,
            tcsPercentage,
        };
    }



    /**
    * ============================================
    * CREATE DEBIT NOTE VOUCHER
    * ============================================
    * 
    * Reverses the original purchase voucher:
    * Dr. Party (reduce payable)
    * Cr. Purchase Return
    * Cr. CGST/SGST/IGST Input (reverse input credit)
    */
    private async createDebitNoteVoucher(
        tx: any,
        organizationId: string,
        debitNote: any,
        originalInvoice: any,
        calculations: any,
        isInterstate: boolean,
        userId: string,
    ) {
        // Get party ledger
        const party = await tx.party.findUnique({
            where: { id: debitNote.partyId },
            include: { ledger: true },
        });

        if (!party || !party.ledger) {
            throw new BadRequestException('Party ledger not found');
        }

        // Get required ledgers
        const purchaseReturnLedger = await this.ledgerSetupService.getSystemLedger(
            organizationId,
            'Purchase Return',
        );

        const cgstLedger = await this.ledgerSetupService.getSystemLedger(
            organizationId,
            'CGST Input',
        );

        const sgstLedger = await this.ledgerSetupService.getSystemLedger(
            organizationId,
            'SGST Input',
        );

        const igstLedger = await this.ledgerSetupService.getSystemLedger(
            organizationId,
            'IGST Input',
        );

        const roundOffLedger = await this.ledgerSetupService.getSystemLedger(
            organizationId,
            'Round Off',
        );

        if (!purchaseReturnLedger || !cgstLedger || !sgstLedger || !igstLedger || !roundOffLedger) {
            throw new BadRequestException('Required system ledgers not found');
        }

        const entries: any[] = [];

        // Dr. Party (reduce payable)
        entries.push({
            ledgerId: party.ledger.id,
            ledgerName: party.ledger.ledgerName,
            debitAmount: Number(debitNote.totalAmount),
            creditAmount: 0,
        });

        // Cr. Purchase Return
        entries.push({
            ledgerId: purchaseReturnLedger.id,
            ledgerName: purchaseReturnLedger.ledgerName,
            debitAmount: 0,
            creditAmount: calculations.subtotal - calculations.discountAmount,
        });

        // Cr. GST Input (reversing input credit - ✅ MATCHES ORIGINAL)
        if (isInterstate) {
            if (Number(debitNote.igstAmount) > 0) {
                entries.push({
                    ledgerId: igstLedger.id,
                    ledgerName: igstLedger.ledgerName,
                    debitAmount: 0,
                    creditAmount: Number(debitNote.igstAmount),
                });
            }
        } else {
            if (Number(debitNote.cgstAmount) > 0) {
                entries.push({
                    ledgerId: cgstLedger.id,
                    ledgerName: cgstLedger.ledgerName,
                    debitAmount: 0,
                    creditAmount: Number(debitNote.cgstAmount),
                });
            }
            if (Number(debitNote.sgstAmount) > 0) {
                entries.push({
                    ledgerId: sgstLedger.id,
                    ledgerName: sgstLedger.ledgerName,
                    debitAmount: 0,
                    creditAmount: Number(debitNote.sgstAmount),
                });
            }
        }

        // Round Off
        if (Number(debitNote.roundOff) !== 0) {
            const roundOffAmount = Math.abs(Number(debitNote.roundOff));
            entries.push({
                ledgerId: roundOffLedger.id,
                ledgerName: roundOffLedger.ledgerName,
                debitAmount: Number(debitNote.roundOff) > 0 ? roundOffAmount : 0,
                creditAmount: Number(debitNote.roundOff) < 0 ? roundOffAmount : 0,
            });
        }

        // Create voucher
        const voucherNumber = `DN-${debitNote.invoiceNumber}`;

        const totalDebit = entries.reduce((sum, e) => sum + Number(e.debitAmount), 0);
        const totalCredit = entries.reduce((sum, e) => sum + Number(e.creditAmount), 0);

        const voucher = await tx.voucher.create({
            data: {
                organizationId,
                voucherType: 'debit_note',
                voucherNumber,
                voucherDate: debitNote.invoiceDate,
                narration: `Debit Note ${debitNote.invoiceNumber} for Invoice ${originalInvoice.invoiceNumber}. Reason: ${debitNote.returnReason}`,
                referenceType: 'debit_note',
                referenceId: debitNote.id,
                referenceNumber: debitNote.invoiceNumber,
                totalDebit: Math.round(totalDebit * 100) / 100,
                totalCredit: Math.round(totalCredit * 100) / 100,
                isPosted: true,
                createdBy: userId,
            },
        });

        // Create entries and update ledgers
        for (const entry of entries) {
            await tx.voucherEntry.create({
                data: {
                    voucherId: voucher.id,
                    ledgerId: entry.ledgerId,
                    ledgerName: entry.ledgerName,
                    debitAmount: entry.debitAmount,
                    creditAmount: entry.creditAmount,
                },
            });

            // Update ledger balance
            if (Number(entry.debitAmount) > 0) {
                await tx.ledger.update({
                    where: { id: entry.ledgerId },
                    data: {
                        currentBalance: {
                            increment: entry.debitAmount,
                        },
                    },
                });
            } else if (Number(entry.creditAmount) > 0) {
                await tx.ledger.update({
                    where: { id: entry.ledgerId },
                    data: {
                        currentBalance: {
                            decrement: entry.creditAmount,
                        },
                    },
                });
            }
        }

        console.log(`✅ Debit Note voucher created: ${voucherNumber}`);
    }
    async createCreditNote(
        organizationId: string,
        dto: CreateCreditNoteDto,
        userId: string,
    ) {
        const originalInvoice = await this.findById(organizationId, dto.originalInvoiceId);

        if (originalInvoice.invoiceType !== 'sale') {
            throw new BadRequestException('Credit note can only be created for sale invoices');
        }

        if (originalInvoice.isCancelled) {
            throw new BadRequestException('Cannot create credit note for cancelled invoice');
        }

        const returnItems = await this.validateReturnItems(
            originalInvoice,
            dto.items,
            'sale_return',
        );

        // ✅ FIX: Use original invoice's GST type
        const isInterstate = Number(originalInvoice.igstAmount) > 0;

        const calculations = await this.calculateReturnTotals(
            returnItems,
            originalInvoice,
            isInterstate, // ✅ Pass original GST type
        );

        // ✅ FIX: Calculate TCS reversal
        const tcsReversal = this.calculateTCSReversal(
            originalInvoice,
            calculations.subtotal - calculations.discountAmount,
        );

        try {
            const creditNote = await this.prisma.$transaction(async (tx) => {
                const orgResult = await tx.$queryRaw<Array<{ invoice_counter: number; invoice_prefix: string }>>`
                UPDATE organizations 
                SET invoice_counter = invoice_counter + 1 
                WHERE id = ${organizationId}::uuid
                RETURNING invoice_counter, invoice_prefix`;

                if (!orgResult || orgResult.length === 0) {
                    throw new NotFoundException('Organization not found');
                }

                const org = {
                    invoiceCounter: orgResult[0].invoice_counter,
                    invoicePrefix: orgResult[0].invoice_prefix,
                };

                const creditNoteNumber = this.invoiceGenerator.generateInvoiceNumber(
                    `${org.invoicePrefix}-CR`,
                    org.invoiceCounter,
                    new Date(),
                );

                const newCreditNote = await tx.invoice.create({
                    data: {
                        organizationId,
                        invoiceType: 'sale_return',
                        invoiceNumber: creditNoteNumber,
                        invoiceDate: new Date(),
                        originalInvoiceId: dto.originalInvoiceId, // ✅ Link to original
                        returnReason: dto.returnReason, // ✅ Store reason
                        partyId: originalInvoice.partyId,
                        partyName: originalInvoice.partyName,
                        partyGstin: originalInvoice.partyGstin,
                        partyState: originalInvoice.partyState,
                        placeOfSupply: originalInvoice.placeOfSupply,
                        subtotal: calculations.subtotal,
                        discountAmount: calculations.discountAmount,
                        cgstAmount: calculations.cgstAmount,
                        sgstAmount: calculations.sgstAmount,
                        igstAmount: calculations.igstAmount,
                        cessAmount: calculations.cessAmount,
                        tcsAmount: tcsReversal.tcsAmount, // ✅ TCS reversal
                        tcsPercentage: tcsReversal.tcsPercentage,
                        roundOff: calculations.roundOff,
                        totalAmount: calculations.totalAmount + tcsReversal.tcsAmount,
                        balanceAmount: calculations.totalAmount + tcsReversal.tcsAmount,
                        notes: `Credit Note for Invoice ${originalInvoice.invoiceNumber}. Reason: ${dto.returnReason}. ${dto.notes || ''}`,
                        reverseCharge: originalInvoice.reverseCharge,
                        createdBy: userId,
                    },
                });

                for (const item of returnItems) {
                    await tx.invoiceItem.create({
                        data: {
                            invoiceId: newCreditNote.id,
                            organizationId,
                            productId: item.productId,
                            productName: item.productName,
                            productCode: item.productCode,
                            hsnCode: item.hsnCode,
                            quantity: item.returnQuantity,
                            unit: item.unit,
                            rate: item.rate,
                            discountPercentage: item.discountPercentage,
                            discountAmount: item.discountAmount,
                            taxableAmount: item.taxableAmount,
                            gstRate: item.gstRate,
                            cgstRate: item.cgstRate,
                            sgstRate: item.sgstRate,
                            igstRate: item.igstRate,
                            cessRate: item.cessRate,
                            cgstAmount: item.cgstAmount,
                            sgstAmount: item.sgstAmount,
                            igstAmount: item.igstAmount,
                            cessAmount: item.cessAmount,
                            totalAmount: item.totalAmount,
                            returnCondition: dto.restockItems !== false ? 'resaleable' : 'damaged', // ✅ NEW
                        },
                    });

                    // ✅ FIX: Create new batch for returned goods
                    if (dto.restockItems !== false && item.productId) {
                        const product = await tx.product.findUnique({
                            where: { id: item.productId },
                        });

                        if (product) {
                            const stockBefore = Number(product.currentStock);
                            const newStock = stockBefore + item.returnQuantity;

                            await tx.product.update({
                                where: { id: item.productId },
                                data: { currentStock: newStock },
                            });

                            // ✅ CREATE NEW BATCH
                            const returnBatchNumber = `RTN-${creditNoteNumber}-${item.productCode || product.productCode}`;

                            await tx.productBatch.create({
                                data: {
                                    organizationId,
                                    productId: item.productId,
                                    batchNumber: returnBatchNumber,
                                    purchaseDate: new Date(),
                                    purchasePrice: Number(item.rate),
                                    openingStock: item.returnQuantity,
                                    currentStock: item.returnQuantity,
                                    returnCondition: 'resaleable',
                                    notes: `Returned from ${originalInvoice.invoiceNumber}. Reason: ${dto.returnReason}`,
                                },
                            });

                            await tx.inventoryTransaction.create({
                                data: {
                                    organizationId,
                                    productId: item.productId,
                                    transactionType: 'sale_return',
                                    quantity: item.returnQuantity,
                                    unit: product.unit,
                                    stockBefore,
                                    stockAfter: newStock,
                                    transactionDate: new Date(),
                                    referenceType: 'credit_note',
                                    referenceId: newCreditNote.id,
                                    referenceNumber: creditNoteNumber,
                                    notes: `Returned via ${creditNoteNumber}. Reason: ${dto.returnReason}`,
                                    createdBy: userId,
                                },
                            });
                        }
                    }
                }

                // ✅ FIX: Update original invoice balance
                const totalCreditAmount = Number(newCreditNote.totalAmount);
                const newBalance = Math.max(0, Number(originalInvoice.balanceAmount) - totalCreditAmount);

                await tx.invoice.update({
                    where: { id: dto.originalInvoiceId },
                    data: { balanceAmount: newBalance },
                });

                // ✅ FIX: Create proper voucher with TCS
                await this.createCreditNoteVoucher(
                    tx,
                    organizationId,
                    newCreditNote,
                    originalInvoice,
                    calculations,
                    tcsReversal,
                    isInterstate,
                    userId,
                );

                return newCreditNote;
            });

            return this.findById(organizationId, creditNote.id);
        } catch (error: any) {
            console.error('❌ Credit note creation failed:', error);
            throw new BadRequestException(
                `Failed to create credit note: ${error.message || 'Unknown error'}`
            );
        }
    }


    /**
    * ============================================
    * CREATE DEBIT NOTE (PURCHASE RETURN)
    * ============================================
    * 
    * ACCOUNTING LOGIC:
    * Dr. Party                  (reduce payable)
    * Cr. Purchase Return        (reduce expense)
    * Cr. CGST/SGST/IGST Input   (reverse input credit)
    * 
    * STOCK LOGIC:
    * - Remove from stock (goods returned to supplier)
    * - Reduce from FIFO batches
    */
    async createDebitNote(
        organizationId: string,
        dto: CreateDebitNoteDto,
        userId: string,
    ) {
        // Get original invoice
        const originalInvoice = await this.findById(organizationId, dto.originalInvoiceId);

        if (originalInvoice.invoiceType !== 'purchase') {
            throw new BadRequestException('Debit note can only be created for purchase invoices');
        }

        if (originalInvoice.isCancelled) {
            throw new BadRequestException('Cannot create debit note for cancelled invoice');
        }

        // Validate return items
        const returnItems = await this.validateReturnItems(
            originalInvoice,
            dto.items,
            'purchase_return',
        );

        // ✅ FIX: Use original invoice's GST type
        const isInterstate = Number(originalInvoice.igstAmount) > 0;

        const calculations = await this.calculateReturnTotals(
            returnItems,
            originalInvoice,
            isInterstate, // ✅ Pass original GST type
        );

        try {
            const debitNote = await this.prisma.$transaction(async (tx) => {
                // Generate debit note number
                const orgResult = await tx.$queryRaw<Array<{ invoice_counter: number; invoice_prefix: string }>>`
                UPDATE organizations 
                SET invoice_counter = invoice_counter + 1 
                WHERE id = ${organizationId}::uuid
                RETURNING invoice_counter, invoice_prefix`;

                if (!orgResult || orgResult.length === 0) {
                    throw new NotFoundException('Organization not found');
                }

                const org = {
                    invoiceCounter: orgResult[0].invoice_counter,
                    invoicePrefix: orgResult[0].invoice_prefix,
                };

                const debitNoteNumber = this.invoiceGenerator.generateInvoiceNumber(
                    `${org.invoicePrefix}-DR`,
                    org.invoiceCounter,
                    new Date(),
                );

                // Create debit note invoice
                const newDebitNote = await tx.invoice.create({
                    data: {
                        organizationId,
                        invoiceType: 'purchase_return',
                        invoiceNumber: debitNoteNumber,
                        invoiceDate: new Date(),
                        originalInvoiceId: dto.originalInvoiceId, // ✅ Link to original
                        returnReason: dto.returnReason, // ✅ Store reason
                        partyId: originalInvoice.partyId,
                        partyName: originalInvoice.partyName,
                        partyGstin: originalInvoice.partyGstin,
                        partyState: originalInvoice.partyState,
                        placeOfSupply: originalInvoice.placeOfSupply,
                        subtotal: calculations.subtotal,
                        discountAmount: calculations.discountAmount,
                        cgstAmount: calculations.cgstAmount,
                        sgstAmount: calculations.sgstAmount,
                        igstAmount: calculations.igstAmount,
                        cessAmount: calculations.cessAmount,
                        roundOff: calculations.roundOff,
                        totalAmount: calculations.totalAmount,
                        balanceAmount: calculations.totalAmount,
                        notes: `Debit Note for Invoice ${originalInvoice.invoiceNumber}. Reason: ${dto.returnReason}. ${dto.notes || ''}`,
                        reverseCharge: originalInvoice.reverseCharge,
                        createdBy: userId,
                    },
                });

                // Create debit note items
                for (const item of returnItems) {
                    await tx.invoiceItem.create({
                        data: {
                            invoiceId: newDebitNote.id,
                            organizationId,
                            productId: item.productId,
                            productName: item.productName,
                            productCode: item.productCode,
                            hsnCode: item.hsnCode,
                            quantity: item.returnQuantity,
                            unit: item.unit,
                            rate: item.rate,
                            discountPercentage: item.discountPercentage,
                            discountAmount: item.discountAmount,
                            taxableAmount: item.taxableAmount,
                            gstRate: item.gstRate,
                            cgstRate: item.cgstRate,
                            sgstRate: item.sgstRate,
                            igstRate: item.igstRate,
                            cessRate: item.cessRate,
                            cgstAmount: item.cgstAmount,
                            sgstAmount: item.sgstAmount,
                            igstAmount: item.igstAmount,
                            cessAmount: item.cessAmount,
                            totalAmount: item.totalAmount,
                            returnCondition: 'returned_to_supplier', // ✅ Track condition
                        },
                    });

                    // ✅ REMOVE FROM STOCK (goods returned to supplier)
                    if (dto.removeFromStock !== false && item.productId) {
                        const product = await tx.product.findUnique({
                            where: { id: item.productId },
                        });

                        if (product) {
                            const stockBefore = Number(product.currentStock);
                            const newStock = stockBefore - item.returnQuantity;

                            if (newStock < 0) {
                                throw new BadRequestException(
                                    `Insufficient stock for ${product.productName}. Available: ${stockBefore}, Return: ${item.returnQuantity}`
                                );
                            }

                            // Update product stock
                            await tx.product.update({
                                where: { id: item.productId },
                                data: { currentStock: newStock },
                            });

                            // ✅ REDUCE FROM BATCHES (FIFO)
                            try {
                                await this.productBatchesService.allocateStock(
                                    tx,
                                    organizationId,
                                    item.productId,
                                    item.returnQuantity,
                                );
                                console.log(`✅ Stock reduced from FIFO batches for ${product.productName}`);
                            } catch (error) {
                                console.warn(`⚠️ Could not allocate from batches, but stock updated`);
                            }

                            // Record inventory transaction
                            await tx.inventoryTransaction.create({
                                data: {
                                    organizationId,
                                    productId: item.productId,
                                    transactionType: 'purchase_return',
                                    quantity: item.returnQuantity,
                                    unit: product.unit,
                                    stockBefore,
                                    stockAfter: newStock,
                                    transactionDate: new Date(),
                                    referenceType: 'debit_note',
                                    referenceId: newDebitNote.id,
                                    referenceNumber: debitNoteNumber,
                                    notes: `Returned to supplier via ${debitNoteNumber}. Reason: ${dto.returnReason}`,
                                    createdBy: userId,
                                },
                            });
                        }
                    }
                }

                // ✅ FIX: Update original invoice balance
                const totalDebitAmount = Number(newDebitNote.totalAmount);
                const newBalance = Math.max(0, Number(originalInvoice.balanceAmount) - totalDebitAmount);

                await tx.invoice.update({
                    where: { id: dto.originalInvoiceId },
                    data: { balanceAmount: newBalance },
                });

                console.log(
                    `✅ Original invoice ${originalInvoice.invoiceNumber} balance updated:\n` +
                    `   Previous Balance: ₹${Number(originalInvoice.balanceAmount).toFixed(2)}\n` +
                    `   Debit Note Amount: ₹${totalDebitAmount.toFixed(2)}\n` +
                    `   New Balance: ₹${newBalance.toFixed(2)}`
                );

                // ✅ CREATE REVERSING VOUCHER
                await this.createDebitNoteVoucher(
                    tx,
                    organizationId,
                    newDebitNote,
                    originalInvoice,
                    calculations,
                    isInterstate,
                    userId,
                );

                return newDebitNote;
            });

            return this.findById(organizationId, debitNote.id);
        } catch (error: any) {
            console.error('❌ Debit note creation failed:', error);
            throw new BadRequestException(
                `Failed to create debit note: ${error.message || 'Unknown error'}`
            );
        }
    }

    /**
     * Validate return items against original invoice
     */
    private async validateReturnItems(
        originalInvoice: any,
        returnItems: any[],
        returnType: 'sale_return' | 'purchase_return',
    ) {
        const validatedItems = [];

        for (const returnItem of returnItems) {
            // Find original item
            const originalItem = originalInvoice.items.find(
                (item: any) => item.id === returnItem.originalItemId,
            );

            if (!originalItem) {
                throw new BadRequestException(
                    `Item ${returnItem.originalItemId} not found in original invoice`,
                );
            }

            // Check if return quantity is valid
            if (returnItem.returnQuantity > Number(originalItem.quantity)) {
                throw new BadRequestException(
                    `Cannot return ${returnItem.returnQuantity} ${originalItem.unit} of ${originalItem.productName}. Original quantity: ${originalItem.quantity}`,
                );
            }

            // Calculate amounts for return item
            const itemTotal = returnItem.returnQuantity * Number(originalItem.rate);
            const itemDiscount = (itemTotal * Number(originalItem.discountPercentage)) / 100;
            const taxableAmount = itemTotal - itemDiscount;

            // Calculate GST (same rates as original)
            const isInterstate = Number(originalItem.igstAmount) > 0;
            const gst = this.gstCalculator.calculateGST(
                taxableAmount,
                Number(originalItem.gstRate),
                isInterstate,
            );

            validatedItems.push({
                productId: originalItem.productId,
                productName: originalItem.productName,
                productCode: originalItem.productCode,
                hsnCode: originalItem.hsnCode,
                returnQuantity: returnItem.returnQuantity,
                unit: originalItem.unit,
                rate: Number(originalItem.rate),
                discountPercentage: Number(originalItem.discountPercentage),
                discountAmount: this.gstCalculator.roundOff(itemDiscount),
                taxableAmount: this.gstCalculator.roundOff(taxableAmount),
                gstRate: Number(originalItem.gstRate),
                cgstRate: gst.cgstAmount > 0 ? Number(originalItem.gstRate) / 2 : 0,
                sgstRate: gst.sgstAmount > 0 ? Number(originalItem.gstRate) / 2 : 0,
                igstRate: gst.igstAmount > 0 ? Number(originalItem.gstRate) : 0,
                cessRate: 0,
                cgstAmount: gst.cgstAmount,
                sgstAmount: gst.sgstAmount,
                igstAmount: gst.igstAmount,
                cessAmount: 0,
                totalAmount: taxableAmount + gst.totalGST,
            });
        }

        return validatedItems;
    }

    private async calculateReturnTotals(
        returnItems: any[],
        originalInvoice: any,
        isInterstate: boolean, // ✅ ADD THIS PARAMETER
    ) {
        const subtotal = returnItems.reduce((sum, item) =>
            sum + (item.returnQuantity * item.rate), 0
        );

        const discountAmount = returnItems.reduce((sum, item) =>
            sum + Number(item.discountAmount), 0
        );

        const cgstAmount = returnItems.reduce((sum, item) =>
            sum + Number(item.cgstAmount), 0
        );

        const sgstAmount = returnItems.reduce((sum, item) =>
            sum + Number(item.sgstAmount), 0
        );

        const igstAmount = returnItems.reduce((sum, item) =>
            sum + Number(item.igstAmount), 0
        );

        const cessAmount = returnItems.reduce((sum, item) =>
            sum + Number(item.cessAmount), 0
        );

        const totalBeforeRoundOff = subtotal - discountAmount + cgstAmount + sgstAmount + igstAmount + cessAmount;
        const roundOff = this.gstCalculator.calculateRoundOff(totalBeforeRoundOff);
        const totalAmount = Math.round(totalBeforeRoundOff);

        return {
            subtotal: this.gstCalculator.roundOff(subtotal),
            discountAmount: this.gstCalculator.roundOff(discountAmount),
            cgstAmount: this.gstCalculator.roundOff(cgstAmount),
            sgstAmount: this.gstCalculator.roundOff(sgstAmount),
            igstAmount: this.gstCalculator.roundOff(igstAmount),
            cessAmount: this.gstCalculator.roundOff(cessAmount),
            roundOff,
            totalAmount,
        };
    }

    private async createInvoiceVoucher(
        tx: any,
        organizationId: string,
        invoice: any,
        party: any,
        isInterstate: boolean,
        userId: string,
    ) {



        const partyLedger = await tx.ledger.findFirst({
            where: {
                organizationId,
                partyId: party.id,
                deletedAt: null,
            }
        });

        if (!partyLedger) {
            throw new NotFoundException(`Party ledger not found for ${party.id}`);
        }

        const salesLedger = await this.ledgerSetupService.getSystemLedger(
            organizationId,
            invoice.invoiceType === 'sale' ? 'Sales - Textile' : 'Purchase - Raw Material',
        );

        const cgstLedger = await this.ledgerSetupService.getSystemLedger(
            organizationId,
            invoice.invoiceType === 'sale' ? 'CGST Output' : 'CGST Input',
        );

        const sgstLedger = await this.ledgerSetupService.getSystemLedger(
            organizationId,
            invoice.invoiceType === 'sale' ? 'SGST Output' : 'SGST Input',
        );

        const igstLedger = await this.ledgerSetupService.getSystemLedger(
            organizationId,
            invoice.invoiceType === 'sale' ? 'IGST Output' : 'IGST Input',
        );

        const roundOffLedger = await this.ledgerSetupService.getSystemLedger(
            organizationId,
            'Round Off',
        );

        if (!salesLedger || !cgstLedger || !sgstLedger || !igstLedger || !roundOffLedger) {
            throw new BadRequestException('Required system ledgers not found. Please contact support.');
        }


        let tscLedger = null;

        if (Number(invoice.tcsAmount) > 0) {
            tscLedger = await this.ledgerSetupService.getSystemLedger(
                organizationId,
                'TCS Payable',
            )
        }

        const entries: any[] = [];

        if (invoice.invoiceType === 'sale') {
            // SALES VOUCHER

            // Dr. Party (Sundry Debtor)
            entries.push({
                ledgerId: partyLedger.id,
                ledgerName: partyLedger.ledgerName,
                debitAmount: Number(invoice.totalAmount),
                creditAmount: 0,
            });

            // Cr. Sales Account
            entries.push({
                ledgerId: salesLedger.id,
                ledgerName: salesLedger.ledgerName,
                debitAmount: 0,
                creditAmount: Number(invoice.subtotal) - Number(invoice.discountAmount),
            });

            // Cr. GST (CGST/SGST or IGST)
            if (isInterstate) {
                if (Number(invoice.igstAmount) > 0) {
                    entries.push({
                        ledgerId: igstLedger.id,
                        ledgerName: igstLedger.ledgerName,
                        debitAmount: 0,
                        creditAmount: Number(invoice.igstAmount),
                    });
                }
            } else {
                if (Number(invoice.cgstAmount) > 0) {
                    entries.push({
                        ledgerId: cgstLedger.id,
                        ledgerName: cgstLedger.ledgerName,
                        debitAmount: 0,
                        creditAmount: Number(invoice.cgstAmount),
                    });
                }
                if (Number(invoice.sgstAmount) > 0) {
                    entries.push({
                        ledgerId: sgstLedger.id,
                        ledgerName: sgstLedger.ledgerName,
                        debitAmount: 0,
                        creditAmount: Number(invoice.sgstAmount),
                    });
                }
            }

            if (Number(invoice.tcsAmount) > 0 && tscLedger) {
                entries.push({
                    ledgerId: tscLedger.id,
                    ledgerName: tscLedger.ledgerName,
                    debitAmount: 0,
                    creditAmount: Number(invoice.tcsAmount),
                })
            }


            // Round Off (can be Dr or Cr)
            if (Number(invoice.roundOff) !== 0) {
                const roundOffAmount = Math.abs(Number(invoice.roundOff));


                if (invoice.invoiceType === 'sale') {
                    entries.push({
                        ledgerId: roundOffLedger.id,
                        ledgerName: roundOffLedger.ledgerName,
                        debitAmount: Number(invoice.roundOff) < 0 ? roundOffAmount : 0,
                        creditAmount: Number(invoice.roundOff) > 0 ? roundOffAmount : 0,
                    });
                } else {
                    entries.push({
                        ledgerId: roundOffLedger.id,
                        ledgerName: roundOffLedger.ledgerName,
                        debitAmount: Number(invoice.roundOff) > 0 ? roundOffAmount : 0,
                        creditAmount: Number(invoice.roundOff) < 0 ? roundOffAmount : 0,
                    });
                }
            }
        } else {
            // PURCHASE VOUCHER
            // Dr. Purchase Account
            entries.push({
                ledgerId: salesLedger.id,
                ledgerName: salesLedger.ledgerName,
                debitAmount: Number(invoice.subtotal) - Number(invoice.discountAmount),
                creditAmount: 0,
            });

            // Dr. GST Input (CGST/SGST or IGST)
            if (isInterstate) {
                if (Number(invoice.igstAmount) > 0) {
                    entries.push({
                        ledgerId: igstLedger.id,
                        ledgerName: igstLedger.ledgerName,
                        debitAmount: Number(invoice.igstAmount),
                        creditAmount: 0,
                    });
                }
            } else {
                if (Number(invoice.cgstAmount) > 0) {
                    entries.push({
                        ledgerId: cgstLedger.id,
                        ledgerName: cgstLedger.ledgerName,
                        debitAmount: Number(invoice.cgstAmount),
                        creditAmount: 0,
                    });
                }
                if (Number(invoice.sgstAmount) > 0) {
                    entries.push({
                        ledgerId: sgstLedger.id,
                        ledgerName: sgstLedger.ledgerName,
                        debitAmount: Number(invoice.sgstAmount),
                        creditAmount: 0,
                    });
                }
            }

            // Round Off
            if (Number(invoice.roundOff) !== 0) {
                entries.push({
                    ledgerId: roundOffLedger.id,
                    ledgerName: roundOffLedger.ledgerName,
                    debitAmount: Number(invoice.roundOff) > 0 ? Number(invoice.roundOff) : 0,
                    creditAmount: Number(invoice.roundOff) < 0 ? Math.abs(Number(invoice.roundOff)) : 0,
                });
            }

            // Cr. Party (Sundry Creditor)
            entries.push({
                ledgerId: partyLedger.id,
                ledgerName: partyLedger.ledgerName,
                debitAmount: 0,
                creditAmount: Number(invoice.totalAmount),
            });
        }

        // Create voucher
        const voucherNumber = `${invoice.invoiceType === 'sale' ? 'SALES' : 'PURCH'}-${invoice.invoiceNumber}`;

        const totalDebit = entries.reduce((sum, e) => sum + Number(e.debitAmount), 0);
        const totalCredit = entries.reduce((sum, e) => sum + Number(e.creditAmount), 0);

        const voucher = await tx.voucher.create({
            data: {
                organizationId,
                voucherType: invoice.invoiceType === 'sale' ? 'sales' : 'purchase',
                voucherNumber,
                voucherDate: invoice.invoiceDate,
                narration: `${invoice.invoiceType === 'sale' ? 'Sale' : 'Purchase'} to ${party.businessName} vide Invoice ${invoice.invoiceNumber}`,
                referenceType: 'invoice',
                referenceId: invoice.id,
                referenceNumber: invoice.invoiceNumber,
                totalDebit: Math.round(totalDebit * 100) / 100,
                totalCredit: Math.round(totalCredit * 100) / 100,
                isPosted: true,
                createdBy: userId,
            },
        });

        // Create voucher entries
        for (const entry of entries) {
            await tx.voucherEntry.create({
                data: {
                    voucherId: voucher.id,
                    ledgerId: entry.ledgerId,
                    ledgerName: entry.ledgerName,
                    debitAmount: entry.debitAmount,
                    creditAmount: entry.creditAmount,
                },
            });

            // Update ledger balance
            if (Number(entry.debitAmount) > 0) {
                await tx.ledger.update({
                    where: { id: entry.ledgerId },
                    data: {
                        currentBalance: {
                            increment: entry.debitAmount,
                        },
                    },
                });
            } else if (Number(entry.creditAmount) > 0) {
                await tx.ledger.update({
                    where: { id: entry.ledgerId },
                    data: {
                        currentBalance: {
                            decrement: entry.creditAmount,
                        },
                    },
                });
            }
        }
    }

}