import { Injectable, NotFoundException, BadRequestException, ConflictException } from "@nestjs/common";
import { prisma } from "@textile/database";
import { CreateProductDto, ProductFiltersDto, UpdateProductDto, UpdateStockDto } from "./dto";
import { Prisma } from "@textile/database";
import { LedgerSetupService } from "../vouchers/services/ledger-setup.service";


@Injectable()
export class ProductsService {
    constructor(private prisma: prisma.PrismaService, private ledgerSetupService: LedgerSetupService) { }

    async create(dto: CreateProductDto, organizationId: string, userId: string) {
        const existing = await this.prisma.product.findFirst({
            where: { productCode: dto.productCode, organizationId }
        });

        if (existing) {
            throw new ConflictException('Product already exists');
        }

        if (dto.barcode) {
            const existingBarcode = await this.prisma.product.findFirst({
                where: {
                    barcode: dto.barcode,
                    organizationId,
                },
            });

            if (existingBarcode) {
                throw new ConflictException('Barcode already exists');
            }
        }

        return this.prisma.product.create({
            data: {
                ...dto,
                organizationId,
                createdBy: userId,
                imageUrls: dto.imageUrls || [],
                currentStock: dto.currentStock || 0,
                minStockLevel: dto.minStockLevel || 0,
                cessRate: dto.cessRate || 0,
            },
        });
    }

    async findAll(organizationId: string, filters: ProductFiltersDto) {
        const { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'DESC' } = filters;

        const where: Prisma.ProductWhereInput = {
            organizationId,
            deletedAt: null,
        };

        if (filters.category) {
            where.category = filters.category;
        }

        if (filters.search) {
            where.OR = [
                { productName: { contains: filters.search, mode: 'insensitive' } },
                { productCode: { contains: filters.search, mode: 'insensitive' } },
                { designNumber: { contains: filters.search, mode: 'insensitive' } },
                { barcode: { contains: filters.search } },
            ];
        }

        if (filters.isActive !== undefined) {
            where.isActive = filters.isActive;
        }

        if (filters.lowStock) {
            where.currentStock = {
                lte: this.prisma.product.fields.minStockLevel,
            };
        }

        const [data, total] = await Promise.all([
            this.prisma.product.findMany({
                where,
                orderBy: { [sortBy]: sortOrder.toLowerCase() },
                skip: (page - 1) * limit,
                take: limit,
            }),
            this.prisma.product.count({ where }),
        ]);

        return {
            data,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
    }


    async search(organizationId: string, search: string) {
        if (!search || !search.trim()) {
            return [];
        }

        return this.prisma.product.findMany({
            where: {
                organizationId,
                deletedAt: null,
                isActive: true,
                OR: [
                    { productName: { contains: search, mode: 'insensitive' } },
                    { productCode: { contains: search, mode: 'insensitive' } },
                    { hsnCode: { contains: search, mode: 'insensitive' } },
                    { designNumber: { contains: search, mode: 'insensitive' } },
                    { barcode: { contains: search } },
                ],
            },
            take: 15,
            orderBy: { productName: 'asc' },
            select: {
                id: true,
                productCode: true,
                productName: true,
                hsnCode: true,
                gstRate: true,
                basePrice: true,
                salePrice: true,
                unit: true,
                currentStock: true,
                primaryImageUrl: true,
            },
        });
    }

    async findById(organizationId: string, id: string) {
        const product = await this.prisma.product.findFirst({
            where: {
                id,
                organizationId,
                deletedAt: null,
            },
        });

        if (!product) {
            throw new NotFoundException('Product not found');
        }

        return product;
    }
    async findByBarcode(organizationId: string, barcode: string) {
        const product = await this.prisma.product.findFirst({
            where: {
                barcode,
                organizationId,
                isActive: true,
                deletedAt: null,
            },
        });

        if (!product) {
            throw new NotFoundException('Product not found with this barcode');
        }

        return product;
    }

    async update(organizationId: string, id: string, dto: UpdateProductDto) {
        await this.findById(organizationId, id);

        return this.prisma.product.update({
            where: { id },
            data: dto,
        });
    }


    async updateStock(organizationId: string, id: string, dto: UpdateStockDto, userId: string) {
        const product = await this.findById(organizationId, id);

        const stockBefore = Number(product.currentStock);
        let stockAfter: number;
        let quantityChange: number;

        if (dto.type === 'adjustment') {
            stockAfter = dto.quantity;
            quantityChange = stockAfter - stockBefore;
        } else if (dto.type === 'purchase' || dto.type === 'return') {
            stockAfter = stockBefore + dto.quantity;
            quantityChange = dto.quantity;
        } else if (dto.type === 'sale') {
            stockAfter = stockBefore - dto.quantity;
            quantityChange = -dto.quantity;
            if (stockAfter < 0) {
                throw new BadRequestException('Insufficient stock');
            }
        } else {
            throw new BadRequestException('Invalid stock update type');
        }

        return this.prisma.$transaction(async (tx) => {
            // ✅ STEP 1: Update product stock
            const updatedProduct = await tx.product.update({
                where: { id },
                data: { currentStock: stockAfter },
            });

            // ✅ STEP 2: Record inventory transaction
            await tx.inventoryTransaction.create({
                data: {
                    organizationId,
                    productId: id,
                    transactionType: dto.type,
                    quantity: dto.quantity,
                    unit: product.unit,
                    stockBefore,
                    stockAfter,
                    transactionDate: new Date(),
                    notes: dto.notes,
                    createdBy: userId,
                },
            });

            // ✅ STEP 3: Create accounting voucher (only for adjustments)
            if (dto.type === 'adjustment' && quantityChange !== 0) {
                await this.createStockAdjustmentVoucher(
                    tx,
                    organizationId,
                    product,
                    quantityChange,
                    dto.notes,
                    userId,
                );
            }

            return updatedProduct;
        });
    }


    private async createStockAdjustmentVoucher(
        tx: any,
        organizationId: string,
        product: any,
        quantityChange: number,
        notes: string | undefined,
        userId: string,
    ) {
        // Calculate value (quantity × purchase price)
        const valueChange = Math.abs(quantityChange) * Number(product.purchasePrice || product.basePrice);

        if (valueChange === 0) {
            return; // No value change, no voucher needed
        }

        // Get required ledgers
        const inventoryLedger = await this.ledgerSetupService.getSystemLedger(
            organizationId,
            'Closing Stock', // We need to add this ledger
        );

        // If Closing Stock ledger doesn't exist, skip voucher creation
        // (We'll add proper inventory ledgers in next phase)
        if (!inventoryLedger) {
            console.warn('Closing Stock ledger not found. Stock adjustment voucher not created.');
            return;
        }

        const adjustmentLedger = quantityChange > 0
            ? await this.ledgerSetupService.getSystemLedger(organizationId, 'Stock Adjustment - Gain')
            : await this.ledgerSetupService.getSystemLedger(organizationId, 'Stock Adjustment - Loss');

        if (!adjustmentLedger) {
            console.warn('Stock Adjustment ledger not found. Voucher not created.');
            return;
        }

        // Generate voucher number
        const now = new Date();
        const year = now.getFullYear().toString().slice(-2);
        const month = String(now.getMonth() + 1).padStart(2, '0');

        const lastVoucher = await tx.voucher.findFirst({
            where: {
                organizationId,
                voucherType: 'journal',
                voucherDate: {
                    gte: new Date(now.getFullYear(), now.getMonth(), 1),
                    lt: new Date(now.getFullYear(), now.getMonth() + 1, 1),
                },
            },
            orderBy: { createdAt: 'desc' },
            select: { voucherNumber: true },
        });

        let counter = 1;
        if (lastVoucher) {
            const parts = lastVoucher.voucherNumber.split('-');
            counter = parseInt(parts[parts.length - 1], 10) + 1;
        }

        const voucherNumber = `JV-${year}${month}-${String(counter).padStart(4, '0')}`;

        // Create voucher
        const narration = quantityChange > 0
            ? `Stock adjustment - ${Math.abs(quantityChange)} ${product.unit} of ${product.productName} added. ${notes || 'Stock found during physical verification'}`
            : `Stock adjustment - ${Math.abs(quantityChange)} ${product.unit} of ${product.productName} removed. ${notes || 'Damaged/Lost stock'}`;

        const voucher = await tx.voucher.create({
            data: {
                organizationId,
                voucherType: 'journal',
                voucherNumber,
                voucherDate: now,
                narration,
                referenceType: 'stock_adjustment',
                referenceId: product.id,
                referenceNumber: product.productCode,
                totalDebit: valueChange,
                totalCredit: valueChange,
                isPosted: true,
                createdBy: userId,
            },
        });

        // Create entries
        const entries = quantityChange > 0
            ? [
                // Stock increase: Dr. Inventory, Cr. Gain
                {
                    ledgerId: inventoryLedger.id,
                    ledgerName: inventoryLedger.ledgerName,
                    debitAmount: valueChange,
                    creditAmount: 0,
                },
                {
                    ledgerId: adjustmentLedger.id,
                    ledgerName: adjustmentLedger.ledgerName,
                    debitAmount: 0,
                    creditAmount: valueChange,
                },
            ]
            : [
                // Stock decrease: Dr. Loss, Cr. Inventory
                {
                    ledgerId: adjustmentLedger.id,
                    ledgerName: adjustmentLedger.ledgerName,
                    debitAmount: valueChange,
                    creditAmount: 0,
                },
                {
                    ledgerId: inventoryLedger.id,
                    ledgerName: inventoryLedger.ledgerName,
                    debitAmount: 0,
                    creditAmount: valueChange,
                },
            ];

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

            // Update ledger balances
            if (entry.debitAmount > 0) {
                await tx.ledger.update({
                    where: { id: entry.ledgerId },
                    data: {
                        currentBalance: {
                            increment: entry.debitAmount,
                        },
                    },
                });
            } else if (entry.creditAmount > 0) {
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
    /**
     * Get low stock products
     */
    async getLowStockProducts(organizationId: string) {
        return this.prisma.product.findMany({
            where: {
                organizationId,
                isActive: true,
                deletedAt: null,
                currentStock: {
                    lte: this.prisma.product.fields.minStockLevel,
                },
            },
            orderBy: { currentStock: 'asc' },
            select: {
                id: true,
                productCode: true,
                productName: true,
                currentStock: true,
                minStockLevel: true,
                unit: true,
            },
        });
    }

    /**
     * Get product categories
     */
    async getCategories(organizationId: string) {
        const products = await this.prisma.product.findMany({
            where: {
                organizationId,
                deletedAt: null,
            },
            select: {
                category: true,
            },
            distinct: ['category'],
        });

        return products
            .map((p) => p.category)
            .filter((c) => c !== null)
            .sort();
    }

    /**
     * Delete product (soft delete)
     */
    async remove(organizationId: string, id: string) {
        await this.findById(organizationId, id);

        await this.prisma.product.update({
            where: { id },
            data: { deletedAt: new Date() },
        });
    }
}


