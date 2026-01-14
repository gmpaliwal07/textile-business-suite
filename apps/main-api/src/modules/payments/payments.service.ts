import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { prisma } from '@textile/database';
import { CreatePaymentDto, UpdatePaymentDto, PaymentFiltersDto, CreateBillwisePaymentDto, PaymentAllocationDto } from './dto/index';
import { PaymentMode, PaymentType, Prisma } from '@textile/database';
import { VouchersService } from '../vouchers/vouchers.service';
import { LedgerSetupService } from '../vouchers/services/ledger-setup.service';

@Injectable()
export class PaymentsService {
    constructor(
        private prisma: prisma.PrismaService,
        private vouchersService: VouchersService,
        private ledgerSetupService: LedgerSetupService,
    ) { }

    /**
    * ============================================
    * CREATE BILL-WISE PAYMENT (PRIMARY METHOD)
    * ============================================
    * 
    * Supports:
    * - Multiple invoice allocation
    * - Partial payments
    * - Advance/on-account payments
    * - Excess payment handling
    * - Credit/Debit note payments
    */
    async createBillwisePayment(organizationId: string, dto: CreateBillwisePaymentDto, userId: string) {
        const party = await this.prisma.party.findFirst({
            where: { id: dto.partyId, organizationId },
            include: { ledger: true },
        });

        if (!party) {
            throw new NotFoundException('Party not found');
        }

        let allocations: PaymentAllocationDto[] = dto.allocations || [];
        let totalAllocated = 0;

        // ✅ IMPROVED VALIDATION LOGIC
        if (allocations.length > 0) {
            for (const allocation of allocations) {
                const invoice = await this.prisma.invoice.findFirst({
                    where: {
                        id: allocation.invoiceId,
                        organizationId,
                        partyId: dto.partyId,
                        deletedAt: null,
                        isCancelled: false,
                        // ✅ Support all invoice types including returns
                        invoiceType: {
                            in: ['sale', 'purchase', 'sale_return', 'purchase_return']
                        },
                    },
                });

                if (!invoice) {
                    throw new NotFoundException(
                        `Invoice ${allocation.invoiceId} not found or doesn't belong to this party`
                    );
                }

                // ✅ Validate payment direction matches invoice type
                if (dto.paymentType === 'received') {
                    // Receiving money from customer (Dr. Cash, Cr. Party)
                    if (!['sale', 'purchase_return'].includes(invoice.invoiceType)) {
                        throw new BadRequestException(
                            `Cannot receive payment for ${invoice.invoiceType} invoice. ` +
                            `Payment type "received" is only valid for "sale" or "purchase_return" invoices.`
                        );
                    }
                } else if (dto.paymentType === 'paid') {
                    // Paying money to supplier/customer (Dr. Party, Cr. Cash)
                    if (!['purchase', 'sale_return'].includes(invoice.invoiceType)) {
                        throw new BadRequestException(
                            `Cannot make payment for ${invoice.invoiceType} invoice. ` +
                            `Payment type "paid" is only valid for "purchase" or "sale_return" invoices.`
                        );
                    }
                }

                // ✅ Validate allocation amount
                if (allocation.amount <= 0) {
                    throw new BadRequestException(
                        `Allocation amount must be greater than zero for invoice ${invoice.invoiceNumber}`
                    );
                }

                // ✅ CHANGED: Allow excess payment with warning (it will adjust invoice to negative balance)
                if (allocation.amount > Number(invoice.balanceAmount)) {
                    const excess = allocation.amount - Number(invoice.balanceAmount);
                    console.warn(
                        `⚠️ EXCESS PAYMENT WARNING:\n` +
                        `   Invoice: ${invoice.invoiceNumber}\n` +
                        `   Balance: ₹${invoice.balanceAmount}\n` +
                        `   Allocating: ₹${allocation.amount}\n` +
                        `   Excess: ₹${excess.toFixed(2)}\n` +
                        `   Result: Invoice balance will become negative (advance to customer).`
                    );
                }

                totalAllocated += allocation.amount;
            }

            // ✅ Validate total allocated doesn't exceed payment amount
            if (totalAllocated > dto.amount) {
                throw new BadRequestException(
                    `Total allocation (₹${totalAllocated.toFixed(2)}) exceeds payment amount (₹${dto.amount.toFixed(2)}). ` +
                    `Please adjust allocation amounts.`
                );
            }

            // ✅ Log partial allocation (unallocated amount remains as advance)
            const unallocated = dto.amount - totalAllocated;
            if (unallocated > 0.01) {
                console.log(
                    `ℹ️ PARTIAL ALLOCATION:\n` +
                    `   Payment Amount: ₹${dto.amount.toFixed(2)}\n` +
                    `   Allocated: ₹${totalAllocated.toFixed(2)} (${allocations.length} invoice${allocations.length > 1 ? 's' : ''})\n` +
                    `   Unallocated: ₹${unallocated.toFixed(2)} (will remain as advance/on-account)`
                );
            }
        } else {
            // No allocations = Full advance/on-account payment
            console.log(
                `ℹ️ ADVANCE PAYMENT: ₹${dto.amount.toFixed(2)} received as advance/on-account from ${party.businessName}`
            );
        }

        try {
            const payment = await this.prisma.$transaction(async (tx) => {
                // Create payment record
                const newPayment = await tx.payment.create({
                    data: {
                        organizationId,
                        paymentType: dto.paymentType as PaymentType,
                        paymentMode: dto.paymentMode as PaymentMode,
                        paymentDate: dto.paymentDate ? new Date(dto.paymentDate) : new Date(),
                        partyId: dto.partyId,
                        partyName: party.businessName,
                        amount: dto.amount,
                        invoiceId: null, // Bill-wise payments don't use single invoiceId
                        referenceNumber: dto.referenceNumber,
                        bankName: dto.bankName,
                        chequeNumber: dto.chequeNumber,
                        chequeDate: dto.chequeDate ? new Date(dto.chequeDate) : null,
                        chequeStatus: dto.chequeStatus || (dto.paymentMode === 'cheque' ? 'pending' : null),
                        upiTransactionId: dto.upiTransactionId,
                        cardLast4Digits: dto.cardLast4Digits,
                        notes: this.buildPaymentNotes(dto, allocations),
                        createdBy: userId,
                    },
                });

                // Create allocations and update invoices
                if (allocations.length > 0) {
                    for (const allocation of allocations) {
                        // Create payment allocation record
                        await tx.paymentAllocation.create({
                            data: {
                                paymentId: newPayment.id,
                                invoiceId: allocation.invoiceId,
                                amount: allocation.amount,
                            },
                        });

                        // Update invoice paid/balance amounts
                        const invoice = await tx.invoice.findUnique({
                            where: { id: allocation.invoiceId },
                        });

                        if (invoice) {
                            const newPaidAmount = Number(invoice.paidAmount) + allocation.amount;
                            const newBalanceAmount = Number(invoice.totalAmount) - newPaidAmount;

                            await tx.invoice.update({
                                where: { id: allocation.invoiceId },
                                data: {
                                    paidAmount: newPaidAmount,
                                    balanceAmount: newBalanceAmount, // ✅ Can go negative (advance)
                                },
                            });

                            console.log(
                                `   ✓ Invoice ${invoice.invoiceNumber}: ` +
                                `Paid ₹${allocation.amount.toFixed(2)}, ` +
                                `Balance: ₹${newBalanceAmount.toFixed(2)}`
                            );
                        }
                    }
                }

                // Create accounting voucher
                await this.createBillwisePaymentVoucher(
                    tx,
                    organizationId,
                    newPayment,
                    party,
                    dto.paymentMode,
                    allocations,
                    userId
                );

                console.log(
                    `✅ Payment recorded: ${newPayment.paymentType === 'received' ? 'Receipt' : 'Payment'} ` +
                    `of ₹${newPayment.amount.toFixed(2)} ${newPayment.paymentType === 'received' ? 'from' : 'to'} ` +
                    `${party.businessName} via ${this.getPaymentModeLabel(dto.paymentMode)}`
                );

                return newPayment;
            });

            return this.findBillwisePaymentById(organizationId, payment.id);
        } catch (error: any) {
            console.error('❌ Bill-wise payment creation failed:', error);

            if (error instanceof BadRequestException || error instanceof NotFoundException) {
                throw error;
            }

            throw new BadRequestException(
                `Failed to record payment: ${error.message || 'Unknown error occurred'}`
            );
        }
    }

    async findBillwisePaymentById(organizationId: string, id: string) {
        const payment = await this.prisma.payment.findFirst({
            where: { id, organizationId, deletedAt: null },
            include: {
                party: true,
                allocations: {
                    include: {
                        invoice: {
                            select: {
                                invoiceNumber: true,
                                invoiceDate: true,
                                totalAmount: true,
                                paidAmount: true,
                                balanceAmount: true,
                            },
                        },
                    },
                },
            },
        });

        if (!payment) {
            throw new NotFoundException('Payment not found');
        }

        return payment;
    }

    private buildPaymentNotes(dto: CreateBillwisePaymentDto, allocations: PaymentAllocationDto[]): string {
        let notes = dto.notes || '';

        if (allocations.length === 0) {
            notes = `Advance/On-account payment. ${notes}`.trim();
        } else if (allocations.length === 1) {
            notes = `Payment against 1 invoice. ${notes}`.trim();
        } else {
            notes = `Payment allocated across ${allocations.length} invoices. ${notes}`.trim();
        }

        return notes;
    }

    private async createBillwisePaymentVoucher(
        tx: any,
        organizationId: string,
        payment: any,
        party: any,
        paymentMode: PaymentMode,
        allocations: PaymentAllocationDto[],
        userId: string,
    ) {
        const partyLedger = await tx.ledger.findFirst({
            where: { organizationId, partyId: party.id, deletedAt: null },
        });

        if (!partyLedger) {
            throw new BadRequestException(`Party ledger not found for ${party.businessName}`);
        }

        let cashBankLedger;
        if (paymentMode === 'cash') {
            cashBankLedger = await this.ledgerSetupService.getSystemLedger(organizationId, 'Cash-in-Hand');
        } else {
            cashBankLedger = await this.ledgerSetupService.getSystemLedger(organizationId, payment.bankName || 'Bank Account');
            if (!cashBankLedger) {
                cashBankLedger = await this.ledgerSetupService.getSystemLedger(organizationId, 'Bank Account');
            }
        }

        if (!cashBankLedger) {
            throw new BadRequestException('Cash/Bank ledger not found');
        }

        const entries: any[] = [];

        if (payment.paymentType === 'received') {
            entries.push({
                ledgerId: cashBankLedger.id,
                ledgerName: cashBankLedger.ledgerName,
                debitAmount: Number(payment.amount),
                creditAmount: 0,
            });

            entries.push({
                ledgerId: partyLedger.id,
                ledgerName: partyLedger.ledgerName,
                debitAmount: 0,
                creditAmount: Number(payment.amount),
            });
        } else {
            entries.push({
                ledgerId: partyLedger.id,
                ledgerName: partyLedger.ledgerName,
                debitAmount: Number(payment.amount),
                creditAmount: 0,
            });

            entries.push({
                ledgerId: cashBankLedger.id,
                ledgerName: cashBankLedger.ledgerName,
                debitAmount: 0,
                creditAmount: Number(payment.amount),
            });
        }

        const voucherType = payment.paymentType === 'received' ? 'receipt' : 'payment';
        const voucherPrefix = payment.paymentType === 'received' ? 'RCPT' : 'PMT';

        const paymentDate = new Date(payment.paymentDate);
        const year = paymentDate.getFullYear().toString().slice(-2);
        const month = String(paymentDate.getMonth() + 1).padStart(2, '0');

        const lastVoucher = await tx.voucher.findFirst({
            where: {
                organizationId,
                voucherType,
                voucherDate: {
                    gte: new Date(paymentDate.getFullYear(), paymentDate.getMonth(), 1),
                    lt: new Date(paymentDate.getFullYear(), paymentDate.getMonth() + 1, 1),
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

        const voucherNumber = `${voucherPrefix}-${year}${month}-${String(counter).padStart(4, '0')}`;

        let narration = `${payment.paymentType === 'received' ? 'Receipt' : 'Payment'} ${payment.paymentType === 'received' ? 'from' : 'to'} ${party.businessName}`;

        if (allocations.length === 0) {
            narration += ' (Advance/On-account)';
        } else if (allocations.length === 1) {
            const invoice = await tx.invoice.findUnique({
                where: { id: allocations[0].invoiceId },
                select: { invoiceNumber: true },
            });
            narration += ` against Invoice ${invoice?.invoiceNumber}`;
        } else {
            narration += ` against ${allocations.length} invoices`;
        }

        narration += ` via ${this.getPaymentModeLabel(paymentMode)}`;

        if (payment.chequeNumber) {
            narration += ` (Cheque No: ${payment.chequeNumber})`;
        }
        if (payment.upiTransactionId) {
            narration += ` (UPI Txn: ${payment.upiTransactionId})`;
        }
        if (payment.referenceNumber) {
            narration += ` (Ref: ${payment.referenceNumber})`;
        }

        const voucher = await tx.voucher.create({
            data: {
                organizationId,
                voucherType,
                voucherNumber,
                voucherDate: payment.paymentDate,
                narration,
                referenceType: 'payment',
                referenceId: payment.id,
                referenceNumber: payment.referenceNumber,
                totalDebit: Number(payment.amount),
                totalCredit: Number(payment.amount),
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

    // ============================================
    // OLD: SINGLE INVOICE PAYMENT (BACKWARD COMPATIBLE)
    // ============================================

    async create(organizationId: string, dto: CreatePaymentDto, userId: string) {
        const party = await this.prisma.party.findFirst({
            where: { id: dto.partyId, organizationId },
        });

        if (!party) {
            throw new NotFoundException('Party not found');
        }

        let invoice = null;
        if (dto.invoiceId) {
            invoice = await this.prisma.invoice.findFirst({
                where: { id: dto.invoiceId, organizationId, partyId: dto.partyId },
            });

            if (!invoice) {
                throw new NotFoundException('Invoice not found or does not belong to this party');
            }

            if (dto.paymentType === 'received' && Number(invoice.balanceAmount) < dto.amount) {
                throw new BadRequestException(
                    `Payment amount (${dto.amount}) exceeds invoice balance (${invoice.balanceAmount})`
                );
            }
        }

        try {
            const payment = await this.prisma.$transaction(async (tx) => {
                const newPayment = await tx.payment.create({
                    data: {
                        organizationId,
                        paymentType: dto.paymentType as PaymentType,
                        paymentMode: dto.paymentMode as PaymentMode,
                        paymentDate: dto.paymentDate ? new Date(dto.paymentDate) : new Date(),
                        partyId: dto.partyId,
                        partyName: party.businessName,
                        amount: dto.amount,
                        invoiceId: dto.invoiceId,
                        referenceNumber: dto.referenceNumber,
                        bankName: dto.bankName,
                        chequeNumber: dto.chequeNumber,
                        chequeDate: dto.chequeDate ? new Date(dto.chequeDate) : null,
                        chequeStatus: dto.chequeStatus,
                        upiTransactionId: dto.upiTransactionId,
                        cardLast4Digits: dto.cardLast4Digits,
                        notes: dto.notes,
                        createdBy: userId,
                    },
                });

                if (invoice) {
                    const newPaidAmount = Number(invoice.paidAmount) + dto.amount;
                    const newBalanceAmount = Number(invoice.totalAmount) - newPaidAmount;

                    await tx.invoice.update({
                        where: { id: invoice.id },
                        data: { paidAmount: newPaidAmount, balanceAmount: newBalanceAmount },
                    });
                }

                await this.createPaymentVoucher(tx, organizationId, newPayment, party, dto.paymentMode, invoice, userId);

                return newPayment;
            });

            return this.findById(organizationId, payment.id);
        } catch (error: any) {
            console.error('Payment creation failed:', error);

            if (error instanceof BadRequestException || error instanceof NotFoundException) {
                throw error;
            }

            throw new BadRequestException(`Failed to record payment: ${error.message || 'Unknown error occurred'}`);
        }
    }

    async findById(organizationId: string, id: string) {
        const payment = await this.prisma.payment.findFirst({
            where: { id, organizationId, deletedAt: null },
            include: { party: true, invoice: true },
        });

        if (!payment) {
            throw new NotFoundException('Payment not found');
        }
        return payment;
    }

    private async createPaymentVoucher(
        tx: any,
        organizationId: string,
        payment: any,
        party: any,
        paymentMode: PaymentMode,
        invoice: any,
        userId: string,
    ) {
        const partyLedger = await tx.ledger.findFirst({
            where: { organizationId, partyId: party.id, deletedAt: null },
        });

        if (!partyLedger) {
            throw new BadRequestException(`Party ledger not found for ${party.businessName}`);
        }

        let cashBankLedger;
        if (paymentMode === 'cash') {
            cashBankLedger = await this.ledgerSetupService.getSystemLedger(organizationId, 'Cash-in-Hand');
        } else {
            cashBankLedger = await this.ledgerSetupService.getSystemLedger(organizationId, payment.bankName || 'Bank Account');
            if (!cashBankLedger) {
                cashBankLedger = await this.ledgerSetupService.getSystemLedger(organizationId, 'Bank Account');
            }
        }

        if (!cashBankLedger) {
            throw new BadRequestException('Cash/Bank ledger not found. Please contact support.');
        }

        const entries: any[] = [];

        if (payment.paymentType === 'received') {
            entries.push({
                ledgerId: cashBankLedger.id,
                ledgerName: cashBankLedger.ledgerName,
                debitAmount: Number(payment.amount),
                creditAmount: 0,
            });

            entries.push({
                ledgerId: partyLedger.id,
                ledgerName: partyLedger.ledgerName,
                debitAmount: 0,
                creditAmount: Number(payment.amount),
            });
        } else {
            entries.push({
                ledgerId: partyLedger.id,
                ledgerName: partyLedger.ledgerName,
                debitAmount: Number(payment.amount),
                creditAmount: 0,
            });

            entries.push({
                ledgerId: cashBankLedger.id,
                ledgerName: cashBankLedger.ledgerName,
                debitAmount: 0,
                creditAmount: Number(payment.amount),
            });
        }

        const voucherType = payment.paymentType === 'received' ? 'receipt' : 'payment';
        const voucherPrefix = payment.paymentType === 'received' ? 'RCPT' : 'PMT';

        const paymentDate = new Date(payment.paymentDate);
        const year = paymentDate.getFullYear().toString().slice(-2);
        const month = String(paymentDate.getMonth() + 1).padStart(2, '0');

        const lastVoucher = await tx.voucher.findFirst({
            where: {
                organizationId,
                voucherType,
                voucherDate: {
                    gte: new Date(paymentDate.getFullYear(), paymentDate.getMonth(), 1),
                    lt: new Date(paymentDate.getFullYear(), paymentDate.getMonth() + 1, 1),
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

        const voucherNumber = `${voucherPrefix}-${year}${month}-${String(counter).padStart(4, '0')}`;

        let narration = `${payment.paymentType === 'received' ? 'Receipt' : 'Payment'} ${payment.paymentType === 'received' ? 'from' : 'to'} ${party.businessName}`;
        if (invoice) {
            narration += ` against Invoice ${invoice.invoiceNumber}`;
        }
        narration += ` via ${this.getPaymentModeLabel(paymentMode)}`;
        if (payment.chequeNumber) {
            narration += ` (Cheque No: ${payment.chequeNumber})`;
        }
        if (payment.upiTransactionId) {
            narration += ` (UPI Txn: ${payment.upiTransactionId})`;
        }
        if (payment.referenceNumber) {
            narration += ` (Ref: ${payment.referenceNumber})`;
        }

        const voucher = await tx.voucher.create({
            data: {
                organizationId,
                voucherType,
                voucherNumber,
                voucherDate: payment.paymentDate,
                narration,
                referenceType: 'payment',
                referenceId: payment.id,
                referenceNumber: payment.referenceNumber,
                totalDebit: Number(payment.amount),
                totalCredit: Number(payment.amount),
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

    // ============================================
    // QUERY METHODS
    // ============================================

    async findAll(organizationId: string, filters: PaymentFiltersDto) {
        const { page = 1, limit = 20, sortBy = 'paymentDate', sortOrder = 'DESC' } = filters;

        const where: Prisma.PaymentWhereInput = {
            organizationId,
            deletedAt: null,
        };

        if (filters.paymentType) {
            where.paymentType = filters.paymentType as PaymentType;
        }
        if (filters.paymentMode) {
            where.paymentMode = filters.paymentMode as PaymentMode;
        }
        if (filters.partyId) {
            where.partyId = filters.partyId;
        }
        if (filters.invoiceId) {
            where.invoiceId = filters.invoiceId;
        }
        if (filters.startDate || filters.endDate) {
            where.paymentDate = {};
            if (filters.startDate) {
                where.paymentDate.gte = new Date(filters.startDate);
            }
            if (filters.endDate) {
                where.paymentDate.lte = new Date(filters.endDate);
            }
        }

        const [data, total] = await Promise.all([
            this.prisma.payment.findMany({
                where,
                include: {
                    party: { select: { businessName: true, phone: true } },
                    invoice: { select: { invoiceNumber: true, totalAmount: true, balanceAmount: true } },
                    allocations: {
                        include: {
                            invoice: { select: { invoiceNumber: true, totalAmount: true, balanceAmount: true } },
                        },
                    },
                },
                orderBy: { [sortBy]: sortOrder.toLowerCase() },
                skip: (page - 1) * limit,
                take: limit,
            }),
            this.prisma.payment.count({ where }),
        ]);

        return {
            data,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
    }

    async getInvoicePayments(organizationId: string, invoiceId: string) {
        const [oldPayments, newPayments] = await Promise.all([
            this.prisma.payment.findMany({
                where: { organizationId, invoiceId, deletedAt: null },
                orderBy: { paymentDate: 'desc' },
            }),
            this.prisma.paymentAllocation.findMany({
                where: {
                    invoiceId,
                    payment: { organizationId, deletedAt: null },
                },
                include: { payment: true },
            }),
        ]);

        const paymentMap = new Map();

        oldPayments.forEach(p => {
            paymentMap.set(p.id, { ...p, allocatedAmount: p.amount });
        });

        newPayments.forEach(alloc => {
            if (paymentMap.has(alloc.payment.id)) {
                paymentMap.get(alloc.payment.id).allocatedAmount = alloc.amount;
            } else {
                paymentMap.set(alloc.payment.id, { ...alloc.payment, allocatedAmount: alloc.amount });
            }
        });

        return Array.from(paymentMap.values()).sort((a, b) =>
            new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime()
        );
    }

    async getPartyPayments(organizationId: string, partyId: string) {
        return this.prisma.payment.findMany({
            where: { organizationId, partyId, deletedAt: null },
            orderBy: { paymentDate: 'desc' },
            include: {
                invoice: { select: { invoiceNumber: true, totalAmount: true } },
                allocations: {
                    include: {
                        invoice: { select: { invoiceNumber: true, totalAmount: true } },
                    },
                },
            },
        });
    }

    async getPaymentSummary(organizationId: string, startDate?: string, endDate?: string) {
        const where: Prisma.PaymentWhereInput = { organizationId, deletedAt: null };

        if (startDate || endDate) {
            where.paymentDate = {};
            if (startDate) where.paymentDate.gte = new Date(startDate);
            if (endDate) where.paymentDate.lte = new Date(endDate);
        }

        const [received, paid] = await Promise.all([
            this.prisma.payment.aggregate({
                where: { ...where, paymentType: 'received' },
                _sum: { amount: true },
                _count: true,
            }),
            this.prisma.payment.aggregate({
                where: { ...where, paymentType: 'paid' },
                _sum: { amount: true },
                _count: true,
            }),
        ]);

        return {
            totalReceived: received._sum.amount || 0,
            receivedCount: received._count,
            totalPaid: paid._sum.amount || 0,
            paidCount: paid._count,
            netCashFlow: Number(received._sum.amount || 0) - Number(paid._sum.amount || 0),
        };
    }

    // ============================================
    // UPDATE & DELETE
    // ============================================

    async update(organizationId: string, id: string, dto: UpdatePaymentDto) {
        await this.findById(organizationId, id);

        return this.prisma.payment.update({
            where: { id },
            data: {
                paymentDate: dto.paymentDate ? new Date(dto.paymentDate) : undefined,
                referenceNumber: dto.referenceNumber,
                chequeStatus: dto.chequeStatus,
                notes: dto.notes,
            },
            include: {
                party: true,
                invoice: true,
                allocations: { include: { invoice: true } },
            },
        });
    }
    /**
     * ============================================
     * DELETE PAYMENT (WITH VALIDATION)
     * ============================================
     */
    async remove(organizationId: string, id: string) {
        const payment = await this.prisma.payment.findFirst({
            where: { id, organizationId, deletedAt: null },
            include: {
                allocations: true,
                party: true,
            },
        });

        if (!payment) {
            throw new NotFoundException('Payment not found');
        }

        // ✅ NEW: Check if there are subsequent payments against same invoices
        if (payment.allocations && payment.allocations.length > 0) {
            for (const allocation of payment.allocations) {
                const subsequentPayments = await this.prisma.paymentAllocation.count({
                    where: {
                        invoiceId: allocation.invoiceId,
                        payment: {
                            paymentDate: { gt: payment.paymentDate },
                            deletedAt: null,
                            organizationId,
                        },
                    },
                });

                if (subsequentPayments > 0) {
                    const invoice = await this.prisma.invoice.findUnique({
                        where: { id: allocation.invoiceId },
                        select: { invoiceNumber: true },
                    });

                    throw new BadRequestException(
                        `Cannot delete payment. Later payment(s) exist for invoice ${invoice?.invoiceNumber}. ` +
                        `Please delete subsequent payments first to maintain chronological order.`
                    );
                }
            }
        }

        // ✅ Check for old-style single invoice payment
        if (payment.invoiceId) {
            const subsequentPayments = await this.prisma.payment.count({
                where: {
                    invoiceId: payment.invoiceId,
                    paymentDate: { gt: payment.paymentDate },
                    deletedAt: null,
                    organizationId,
                },
            });

            if (subsequentPayments > 0) {
                throw new BadRequestException(
                    `Cannot delete payment. Later payment(s) exist for this invoice. ` +
                    `Please delete subsequent payments first.`
                );
            }
        }

        await this.prisma.$transaction(async (tx) => {
            // Reverse old-style single invoice payment
            if (payment.invoiceId) {
                const invoice = await tx.invoice.findUnique({
                    where: { id: payment.invoiceId },
                });

                if (invoice) {
                    const newPaidAmount = Number(invoice.paidAmount) - Number(payment.amount);
                    const newBalanceAmount = Number(invoice.totalAmount) - newPaidAmount;

                    await tx.invoice.update({
                        where: { id: invoice.id },
                        data: {
                            paidAmount: Math.max(0, newPaidAmount),
                            balanceAmount: newBalanceAmount,
                        },
                    });
                }
            }

            // Reverse bill-wise allocations
            if (payment.allocations && payment.allocations.length > 0) {
                for (const allocation of payment.allocations) {
                    const invoice = await tx.invoice.findUnique({
                        where: { id: allocation.invoiceId },
                    });

                    if (invoice) {
                        const newPaidAmount = Number(invoice.paidAmount) - Number(allocation.amount);
                        const newBalanceAmount = Number(invoice.totalAmount) - newPaidAmount;

                        await tx.invoice.update({
                            where: { id: allocation.invoiceId },
                            data: {
                                paidAmount: Math.max(0, newPaidAmount),
                                balanceAmount: newBalanceAmount,
                            },
                        });
                    }
                }

                // Delete allocations
                await tx.paymentAllocation.deleteMany({
                    where: { paymentId: payment.id },
                });
            }

            // Reverse voucher
            const voucher = await tx.voucher.findFirst({
                where: { referenceType: 'payment', referenceId: payment.id, deletedAt: null },
                include: { entries: true },
            });

            if (voucher && !voucher.isCancelled) {
                for (const entry of voucher.entries) {
                    const debit = Number(entry.debitAmount);
                    const credit = Number(entry.creditAmount);

                    if (debit > 0) {
                        await tx.ledger.update({
                            where: { id: entry.ledgerId },
                            data: { currentBalance: { decrement: debit } },
                        });
                    } else if (credit > 0) {
                        await tx.ledger.update({
                            where: { id: entry.ledgerId },
                            data: { currentBalance: { increment: credit } },
                        });
                    }
                }

                await tx.voucher.update({
                    where: { id: voucher.id },
                    data: {
                        isCancelled: true,
                        cancelledAt: new Date(),
                        cancellationReason: 'Payment deleted',
                        deletedAt: new Date(),
                    },
                });
            }

            // Soft delete payment
            await tx.payment.update({
                where: { id },
                data: { deletedAt: new Date() },
            });

            console.log(`✅ Payment deleted: ₹${payment.amount} to ${payment.party.businessName}`);
        });

        return { success: true, message: 'Payment deleted successfully' };
    }

    private getPaymentModeLabel(mode: PaymentMode): string {
        const labels: Record<PaymentMode, string> = {
            cash: 'Cash',
            bank: 'Bank Transfer',
            cheque: 'Cheque',
            upi: 'UPI',
            card: 'Card',
            credit: 'Credit',
        };
        return labels[mode] || mode;
    }

    /**
     * ============================================
     * ADJUST ADVANCE PAYMENT AGAINST INVOICE
     * ============================================
     * 
     * Applies an existing advance/on-account payment to an invoice.
     * 
     * Use Case:
     * 1. Customer pays ₹50,000 as advance
     * 2. Invoice created for ₹30,000
     * 3. Adjust ₹30,000 from advance against invoice
     * 4. Remaining ₹20,000 stays as advance
     */
    async adjustAdvancePayment(
        organizationId: string,
        dto: {
            paymentId: string;
            invoiceId: string;
            amount: number;
        },
        userId: string,
    ) {
        // Validate payment exists
        const payment = await this.prisma.payment.findFirst({
            where: {
                id: dto.paymentId,
                organizationId,
                deletedAt: null,
            },
            include: {
                allocations: true,
                party: true,
            },
        });

        if (!payment) {
            throw new NotFoundException('Payment not found');
        }

        // Calculate already allocated amount
        const alreadyAllocated = payment.allocations?.reduce(
            (sum, alloc) => sum + Number(alloc.amount),
            0
        ) || 0;

        const availableAmount = Number(payment.amount) - alreadyAllocated;

        if (availableAmount < dto.amount) {
            throw new BadRequestException(
                `Insufficient advance balance. Available: ₹${availableAmount}, Requested: ₹${dto.amount}`
            );
        }

        // Validate invoice
        const invoice = await this.prisma.invoice.findFirst({
            where: {
                id: dto.invoiceId,
                organizationId,
                partyId: payment.partyId,
                deletedAt: null,
                isCancelled: false,
            },
        });

        if (!invoice) {
            throw new NotFoundException('Invoice not found or does not belong to this party');
        }

        // Validate payment type matches invoice type
        if (payment.paymentType === 'received') {
            // Receiving money - should be against sale or purchase return
            if (!['sale', 'purchase_return'].includes(invoice.invoiceType)) {
                throw new BadRequestException(
                    `Cannot apply received payment to ${invoice.invoiceType} invoice`
                );
            }
        } else {
            // Paying money - should be against purchase or sale return
            if (!['purchase', 'sale_return'].includes(invoice.invoiceType)) {
                throw new BadRequestException(
                    `Cannot apply paid payment to ${invoice.invoiceType} invoice`
                );
            }
        }

        // Check if sufficient balance in invoice
        if (dto.amount > Number(invoice.balanceAmount)) {
            throw new BadRequestException(
                `Adjustment amount ₹${dto.amount} exceeds invoice balance ₹${invoice.balanceAmount}`
            );
        }

        // Create allocation
        await this.prisma.$transaction(async (tx) => {
            // Create payment allocation
            await tx.paymentAllocation.create({
                data: {
                    paymentId: payment.id,
                    invoiceId: invoice.id,
                    amount: dto.amount,
                },
            });

            // Update invoice
            const newPaidAmount = Number(invoice.paidAmount) + dto.amount;
            const newBalanceAmount = Number(invoice.totalAmount) - newPaidAmount;

            await tx.invoice.update({
                where: { id: invoice.id },
                data: {
                    paidAmount: newPaidAmount,
                    balanceAmount: Math.max(0, newBalanceAmount),
                },
            });

            // Update payment notes
            const newNotes = `${payment.notes || ''} | Adjusted ₹${dto.amount} against Invoice ${invoice.invoiceNumber}`.trim();

            await tx.payment.update({
                where: { id: payment.id },
                data: { notes: newNotes },
            });

            console.log(
                `✅ Advance adjusted: ₹${dto.amount} from ${payment.party.businessName} ` +
                `applied to Invoice ${invoice.invoiceNumber}`
            );
        });

        return this.findBillwisePaymentById(organizationId, payment.id);
    }

    /**
  * ============================================
  * HANDLE CHEQUE BOUNCE
  * ============================================
  * 
  * Reverses a cheque payment when it bounces.
  * - Marks cheque as bounced
  * - Reverses all invoice allocations
  * - Reverses accounting voucher
  * - Optionally records bank charges
  */
    async handleChequeBounce(
        organizationId: string,
        paymentId: string,
        dto: {
            bounceReason: string;
            bounceCharges?: number;
            bounceDate?: string;
        },
        userId: string,
    ) {
        const payment = await this.findBillwisePaymentById(organizationId, paymentId);

        if (payment.paymentMode !== 'cheque') {
            throw new BadRequestException('Can only bounce cheque payments');
        }

        if (payment.chequeStatus === 'bounced') {
            throw new BadRequestException('Cheque already marked as bounced');
        }

        await this.prisma.$transaction(async (tx) => {
            // Mark cheque as bounced
            await tx.payment.update({
                where: { id: paymentId },
                data: {
                    chequeStatus: 'bounced',
                    notes: `${payment.notes || ''} | 🚫 BOUNCED on ${dto.bounceDate || new Date().toLocaleDateString()}: ${dto.bounceReason}`.trim(),
                },
            });

            // Reverse invoice allocations
            if (payment.allocations) {
                for (const allocation of payment.allocations) {
                    const invoice = await tx.invoice.findUnique({
                        where: { id: allocation.invoiceId },
                    });

                    if (invoice) {
                        const newPaidAmount = Number(invoice.paidAmount) - Number(allocation.amount);
                        const newBalanceAmount = Number(invoice.totalAmount) - newPaidAmount;

                        await tx.invoice.update({
                            where: { id: allocation.invoiceId },
                            data: {
                                paidAmount: Math.max(0, newPaidAmount),
                                balanceAmount: newBalanceAmount,
                            },
                        });
                    }
                }
            }

            // Reverse old-style single invoice
            if (payment.invoiceId) {
                const invoice = await tx.invoice.findUnique({
                    where: { id: payment.invoiceId },
                });

                if (invoice) {
                    const newPaidAmount = Number(invoice.paidAmount) - Number(payment.amount);
                    const newBalanceAmount = Number(invoice.totalAmount) - newPaidAmount;

                    await tx.invoice.update({
                        where: { id: payment.invoiceId },
                        data: {
                            paidAmount: Math.max(0, newPaidAmount),
                            balanceAmount: newBalanceAmount,
                        },
                    });
                }
            }

            // Reverse voucher
            const voucher = await tx.voucher.findFirst({
                where: { referenceType: 'payment', referenceId: paymentId, deletedAt: null },
                include: { entries: true },
            });

            if (voucher && !voucher.isCancelled) {
                for (const entry of voucher.entries) {
                    const debit = Number(entry.debitAmount);
                    const credit = Number(entry.creditAmount);

                    if (debit > 0) {
                        await tx.ledger.update({
                            where: { id: entry.ledgerId },
                            data: { currentBalance: { decrement: debit } },
                        });
                    } else if (credit > 0) {
                        await tx.ledger.update({
                            where: { id: entry.ledgerId },
                            data: { currentBalance: { increment: credit } },
                        });
                    }
                }

                await tx.voucher.update({
                    where: { id: voucher.id },
                    data: {
                        isCancelled: true,
                        cancelledAt: new Date(),
                        cancellationReason: `Cheque bounced: ${dto.bounceReason}`,
                    },
                });
            }

            // ✅ Record bank charges as expense (if applicable)
            if (dto.bounceCharges && dto.bounceCharges > 0) {
                // Get bank charges ledger
                const bankChargesLedger = await this.ledgerSetupService.getSystemLedger(
                    organizationId,
                    'Bank Charges',
                );

                if (bankChargesLedger) {
                    // Note: You'll need to import ExpensesService or create expense directly
                    console.log(
                        `Bank charges of ₹${dto.bounceCharges} should be recorded. ` +
                        `Create expense manually or integrate with ExpensesService.`
                    );
                }
            }

            console.log(
                `🚫 Cheque bounced: ${payment.chequeNumber} for ₹${payment.amount} ` +
                `from ${payment.party.businessName}. Reason: ${dto.bounceReason}`
            );
        });

        return this.findBillwisePaymentById(organizationId, paymentId);
    }
}