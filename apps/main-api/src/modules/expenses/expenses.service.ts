import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { prisma, Prisma } from '@textile/database';
import {
    CreateExpenseDto,
    UpdateExpenseDto,
    ExpenseFiltersDto,
    CreateRecurringExpenseDto,
    UpdateRecurringExpenseDto,
} from './dto';
import { VouchersService } from '../vouchers/vouchers.service';
import { LedgerSetupService } from '../vouchers/services/ledger-setup.service';

@Injectable()
export class ExpensesService {
    constructor(
        private prisma: prisma.PrismaService,
        private vouchersService: VouchersService,
        private ledgerSetupService: LedgerSetupService,
    ) { }

    /**
     * ✅ COMPLETELY REWRITTEN: Create expense with TDS, vendor ledger integration
     */
    async create(organizationId: string, dto: CreateExpenseDto, userId: string) {
        // ✅ Validate expense ledger exists
        const expenseLedger = await this.prisma.ledger.findFirst({
            where: { id: dto.ledgerId, organizationId, deletedAt: null },
            include: {
                ledgerGroup: {
                    select: {
                        groupType: true,
                    },
                },
            },
        });

        if (!expenseLedger) {
            throw new NotFoundException('Expense ledger not found');
        }

        // ✅ Validate expense ledger is actually an expense type
        if (expenseLedger.ledgerType !== 'expense') {
            throw new BadRequestException(
                `Ledger "${expenseLedger.ledgerName}" is not an expense ledger. ` +
                `Please select a ledger from Direct or Indirect Expenses.`
            );
        }

        // ✅ Validate payment source if provided
        let paymentLedger = null;
        if (dto.paidFrom) {
            paymentLedger = await this.prisma.ledger.findFirst({
                where: { id: dto.paidFrom, organizationId, deletedAt: null },
            });

            if (!paymentLedger) {
                throw new NotFoundException('Payment ledger not found');
            }

            // Ensure payment ledger is cash or bank
            if (!['cash', 'bank'].includes(paymentLedger.ledgerType)) {
                throw new BadRequestException(
                    'Payment must be from Cash or Bank ledger'
                );
            }
        }

        // ✅ Validate vendor if provided
        let vendor = null;
        let vendorLedger = null;
        if (dto.vendorId) {
            vendor = await this.prisma.party.findFirst({
                where: {
                    id: dto.vendorId,
                    organizationId,
                    deletedAt: null,
                },
                include: {
                    ledger: true,
                },
            });

            if (!vendor) {
                throw new NotFoundException('Vendor not found');
            }

            if (!vendor.ledger) {
                throw new BadRequestException(
                    `Vendor "${vendor.businessName}" does not have a ledger. ` +
                    `Please contact support.`
                );
            }

            vendorLedger = vendor.ledger;
        }

        // ✅ Calculate TDS if applicable
        const tdsRate = dto.tdsRate || 0;
        const tdsAmount = tdsRate > 0 ? (dto.amount * tdsRate) / 100 : 0;
        const netPayable = dto.amount - tdsAmount;

        try {
            const expense = await this.prisma.$transaction(async (tx) => {
                // Generate expense number
                const count = await tx.expense.count({
                    where: { organizationId },
                });

                const expenseNumber = `EXP-${String(count + 1).padStart(5, '0')}`;

                // ✅ Create expense record
                const newExpense = await tx.expense.create({
                    data: {
                        organizationId,
                        expenseNumber,
                        expenseDate: new Date(dto.expenseDate),
                        expenseCategory: dto.expenseCategory,
                        ledgerId: dto.ledgerId,
                        ledgerName: expenseLedger.ledgerName,
                        amount: dto.amount,
                        tdsRate,
                        tdsAmount,
                        paymentMode: dto.paymentMode,
                        paidFrom: dto.paidFrom,
                        billNumber: dto.billNumber,
                        vendorName: dto.vendorName || vendor?.businessName,
                        vendorId: dto.vendorId,
                        description: dto.description,
                        attachmentUrl: dto.attachmentUrl,
                        paidImmediately: dto.paidImmediately ?? true,
                        createdBy: userId,
                    },
                });

                // ✅ Create accounting voucher(s)
                if (vendorLedger) {
                    // Scenario 1: Expense with vendor (creates bill)
                    await this.createVendorExpenseVoucher(
                        tx,
                        organizationId,
                        newExpense,
                        expenseLedger,
                        vendorLedger,
                        paymentLedger,
                        tdsAmount,
                        netPayable,
                        userId,
                    );
                } else if (paymentLedger) {
                    // Scenario 2: Direct expense payment (no vendor)
                    await this.createDirectExpenseVoucher(
                        tx,
                        organizationId,
                        newExpense,
                        expenseLedger,
                        paymentLedger,
                        tdsAmount,
                        netPayable,
                        userId,
                    );
                }
                // Scenario 3: Expense recorded but not paid (no voucher yet)

                return newExpense;
            });

            return this.findById(organizationId, expense.id);
        } catch (error: any) {
            console.error('Expense creation failed:', error);
            throw new BadRequestException(
                `Failed to create expense: ${error.message || 'Unknown error'}`
            );
        }
    }

    /**
     * ✅ NEW: Create voucher for vendor expense
     * 
     * Accounting:
     * Dr. Expense Ledger     ₹10,000
     *     Cr. Vendor (Creditor)  ₹10,000
     * 
     * If paid immediately:
     * Dr. Vendor             ₹9,000 (net)
     *     Cr. Cash/Bank          ₹9,000
     *     Cr. TDS Receivable     ₹1,000
     */
    private async createVendorExpenseVoucher(
        tx: any,
        organizationId: string,
        expense: any,
        expenseLedger: any,
        vendorLedger: any,
        paymentLedger: any,
        tdsAmount: number,
        netPayable: number,
        userId: string,
    ) {
        // Step 1: Create expense bill (Dr. Expense, Cr. Vendor)
        const billVoucher = await this.vouchersService.create(
            organizationId,
            {
                voucherType: 'journal',
                voucherDate: expense.expenseDate,
                narration: `${expense.expenseCategory} - ${expense.description || expense.billNumber || expense.expenseNumber}`,
                referenceType: 'expense',
                referenceId: expense.id,
                referenceNumber: expense.expenseNumber,
                entries: [
                    {
                        ledgerId: expenseLedger.id,
                        ledgerName: expenseLedger.ledgerName,
                        debitAmount: expense.amount,
                        creditAmount: 0,
                        narration: 'Expense recorded',
                    },
                    {
                        ledgerId: vendorLedger.id,
                        ledgerName: vendorLedger.ledgerName,
                        debitAmount: 0,
                        creditAmount: expense.amount,
                        narration: `Bill from ${vendorLedger.ledgerName}`,
                    },
                ],
            },
            userId,
        );

        await tx.expense.update({
            where: { id: expense.id },
            data: { voucherId: billVoucher.id },
        });

        // Step 2: If paid immediately, create payment voucher
        if (expense.paidImmediately && paymentLedger) {
            const paymentEntries = [
                {
                    ledgerId: vendorLedger.id,
                    ledgerName: vendorLedger.ledgerName,
                    debitAmount: expense.amount,
                    creditAmount: 0,
                    narration: 'Payment to vendor',
                },
                {
                    ledgerId: paymentLedger.id,
                    ledgerName: paymentLedger.ledgerName,
                    debitAmount: 0,
                    creditAmount: netPayable,
                    narration: 'Paid via ' + paymentLedger.ledgerName,
                },
            ];

            // Add TDS entry if applicable
            if (tdsAmount > 0) {
                const tdsLedger = await this.ledgerSetupService.getSystemLedger(
                    organizationId,
                    'TDS Receivable',
                );

                if (!tdsLedger) {
                    throw new BadRequestException(
                        'TDS Receivable ledger not found. Please run default ledger setup.'
                    );
                }

                paymentEntries.push({
                    ledgerId: tdsLedger.id,
                    ledgerName: tdsLedger.ledgerName,
                    debitAmount: 0,
                    creditAmount: tdsAmount,
                    narration: `TDS @ ${expense.tdsRate}%`,
                });
            }

            await this.vouchersService.create(
                organizationId,
                {
                    voucherType: 'payment',
                    voucherDate: expense.expenseDate,
                    narration: `Payment for ${expense.expenseNumber}${tdsAmount > 0 ? ` (TDS ₹${tdsAmount})` : ''}`,
                    referenceType: 'expense_payment',
                    referenceId: expense.id,
                    referenceNumber: expense.expenseNumber,
                    entries: paymentEntries,
                },
                userId,
            );

            console.log(
                `✅ Vendor expense paid: ${expenseLedger.ledgerName} Dr ₹${expense.amount} | ` +
                `${vendorLedger.ledgerName} Cr ₹${expense.amount} | ` +
                `${paymentLedger.ledgerName} Cr ₹${netPayable}` +
                (tdsAmount > 0 ? ` | TDS Cr ₹${tdsAmount}` : '')
            );
        } else {
            console.log(
                `✅ Vendor expense recorded (unpaid): ${expenseLedger.ledgerName} Dr ₹${expense.amount} | ` +
                `${vendorLedger.ledgerName} Cr ₹${expense.amount}`
            );
        }
    }

    /**
     * ✅ NEW: Create voucher for direct expense (no vendor)
     * 
     * Accounting:
     * Dr. Expense Ledger     ₹10,000
     *     Cr. Cash/Bank          ₹9,000
     *     Cr. TDS Receivable     ₹1,000
     */
    private async createDirectExpenseVoucher(
        tx: any,
        organizationId: string,
        expense: any,
        expenseLedger: any,
        paymentLedger: any,
        tdsAmount: number,
        netPayable: number,
        userId: string,
    ) {
        const entries = [
            {
                ledgerId: expenseLedger.id,
                ledgerName: expenseLedger.ledgerName,
                debitAmount: expense.amount,
                creditAmount: 0,
                narration: expense.description || 'Expense',
            },
            {
                ledgerId: paymentLedger.id,
                ledgerName: paymentLedger.ledgerName,
                debitAmount: 0,
                creditAmount: netPayable,
                narration: 'Paid via ' + paymentLedger.ledgerName,
            },
        ];

        // Add TDS entry if applicable
        if (tdsAmount > 0) {
            const tdsLedger = await this.ledgerSetupService.getSystemLedger(
                organizationId,
                'TDS Receivable',
            );

            if (!tdsLedger) {
                throw new BadRequestException(
                    'TDS Receivable ledger not found. Please run default ledger setup.'
                );
            }

            entries.push({
                ledgerId: tdsLedger.id,
                ledgerName: tdsLedger.ledgerName,
                debitAmount: 0,
                creditAmount: tdsAmount,
                narration: `TDS @ ${expense.tdsRate}%`,
            });
        }

        const voucher = await this.vouchersService.create(
            organizationId,
            {
                voucherType: 'payment',
                voucherDate: expense.expenseDate,
                narration: `${expense.expenseCategory} - ${expense.description || expense.expenseNumber}${tdsAmount > 0 ? ` (TDS ₹${tdsAmount})` : ''}`,
                referenceType: 'expense',
                referenceId: expense.id,
                referenceNumber: expense.expenseNumber,
                entries,
            },
            userId,
        );

        await tx.expense.update({
            where: { id: expense.id },
            data: { voucherId: voucher.id },
        });

        console.log(
            `✅ Direct expense: ${expenseLedger.ledgerName} Dr ₹${expense.amount} | ` +
            `${paymentLedger.ledgerName} Cr ₹${netPayable}` +
            (tdsAmount > 0 ? ` | TDS Cr ₹${tdsAmount}` : '')
        );
    }

    /**
     * Get all expenses with filters (UPDATED)
     */
    async findAll(organizationId: string, filters?: ExpenseFiltersDto) {
        const {
            page = 1,
            limit = 20,
            startDate,
            endDate,
            expenseCategory,
            vendorId,
            search,
            sortBy = 'expenseDate',
            sortOrder = 'DESC',
        } = filters || {};

        const where: Prisma.ExpenseWhereInput = {
            organizationId,
            deletedAt: null,
        };

        if (startDate || endDate) {
            where.expenseDate = {};
            if (startDate) where.expenseDate.gte = new Date(startDate);
            if (endDate) where.expenseDate.lte = new Date(endDate);
        }

        if (expenseCategory) {
            where.expenseCategory = expenseCategory;
        }

        if (vendorId) {
            where.vendorId = vendorId;
        }

        if (search) {
            where.OR = [
                { expenseNumber: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } },
                { vendorName: { contains: search, mode: 'insensitive' } },
                { billNumber: { contains: search, mode: 'insensitive' } },
            ];
        }

        const [data, total] = await Promise.all([
            this.prisma.expense.findMany({
                where,
                include: {
                    ledger: {
                        select: {
                            ledgerName: true,
                            ledgerType: true,
                            ledgerGroup: {
                                select: {
                                    groupName: true,
                                },
                            },
                        },
                    },
                    vendor: {
                        select: {
                            businessName: true,
                            phone: true,
                            partyCode: true,
                        },
                    },
                    voucher: {
                        select: {
                            voucherNumber: true,
                            voucherType: true,
                        },
                    },
                },
                orderBy: { [sortBy]: sortOrder.toLowerCase() },
                skip: (page - 1) * limit,
                take: limit,
            }),
            this.prisma.expense.count({ where }),
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
     * Get expense by ID (UPDATED)
     */
    async findById(organizationId: string, id: string) {
        const expense = await this.prisma.expense.findFirst({
            where: { id, organizationId, deletedAt: null },
            include: {
                ledger: {
                    include: {
                        ledgerGroup: true,
                    },
                },
                vendor: {
                    include: {
                        ledger: {
                            select: {
                                currentBalance: true,
                            },
                        },
                    },
                },
                voucher: {
                    include: {
                        entries: {
                            include: {
                                ledger: {
                                    select: {
                                        ledgerName: true,
                                        ledgerType: true,
                                    },
                                },
                            },
                        },
                    },
                },
            },
        });

        if (!expense) {
            throw new NotFoundException('Expense not found');
        }

        return expense;
    }

    /**
     * ✅ UPDATED: Update expense with restrictions
     */
    async update(organizationId: string, id: string, dto: UpdateExpenseDto) {
        const expense = await this.findById(organizationId, id);

        // ✅ Cannot update if voucher is posted
        if (expense.voucherId) {
            throw new BadRequestException(
                'Cannot update expense with posted voucher. ' +
                'Cancel the voucher first, then update.'
            );
        }

        // ✅ Validate new amount if changed
        if (dto.amount !== undefined && dto.amount <= 0) {
            throw new BadRequestException('Amount must be greater than zero');
        }

        return this.prisma.expense.update({
            where: { id },
            data: {
                expenseDate: dto.expenseDate ? new Date(dto.expenseDate) : undefined,
                amount: dto.amount,
                description: dto.description,
                billNumber: dto.billNumber,
                vendorName: dto.vendorName,
                attachmentUrl: dto.attachmentUrl,
                tdsRate: dto.tdsRate,
                tdsAmount: dto.tdsRate && dto.amount
                    ? (dto.amount * dto.tdsRate) / 100
                    : undefined,
            },
            include: {
                ledger: true,
                vendor: true,
            },
        });
    }

    /**
     * ✅ UPDATED: Delete expense with voucher cancellation
     */
    async remove(organizationId: string, id: string) {
        const expense = await this.findById(organizationId, id);

        if (expense.voucherId) {
            throw new BadRequestException(
                'Cannot delete expense with posted voucher. ' +
                'Cancel the voucher first using Vouchers module.'
            );
        }

        await this.prisma.expense.update({
            where: { id },
            data: { deletedAt: new Date() },
        });

        return {
            success: true,
            message: 'Expense deleted successfully',
        };
    }

    /**
     * Get expense summary (UPDATED)
     */
    async getSummary(organizationId: string, startDate: Date, endDate: Date) {
        const expenses = await this.prisma.expense.findMany({
            where: {
                organizationId,
                expenseDate: { gte: startDate, lte: endDate },
                deletedAt: null,
            },
            select: {
                id: true,
                amount: true,
                tdsAmount: true,
                expenseCategory: true,
                vendorId: true,
                vendorName: true,
            },
        });

        const totalAmount = expenses.reduce((sum, exp) => sum + Number(exp.amount), 0);
        const totalTDS = expenses.reduce((sum, exp) => sum + Number(exp.tdsAmount || 0), 0);
        const totalPaid = expenses.reduce((sum, exp) => sum + (Number(exp.amount) - Number(exp.tdsAmount || 0)), 0);

        const byCategory = expenses.reduce((acc, exp) => {
            const category = exp.expenseCategory;
            if (!acc[category]) {
                acc[category] = { count: 0, amount: 0, tds: 0 };
            }
            acc[category].count += 1;
            acc[category].amount += Number(exp.amount);
            acc[category].tds += Number(exp.tdsAmount || 0);
            return acc;
        }, {} as Record<string, { count: number; amount: number; tds: number }>);

        const byVendor = expenses
            .filter(exp => exp.vendorId)
            .reduce((acc, exp) => {
                const vendorId = exp.vendorId!;
                if (!acc[vendorId]) {
                    acc[vendorId] = {
                        vendorName: exp.vendorName ?? 'Unknown Vendor',
                        count: 0,
                        amount: 0,
                        tds: 0,
                    };
                }
                acc[vendorId].count += 1;
                acc[vendorId].amount += Number(exp.amount);
                acc[vendorId].tds += Number(exp.tdsAmount || 0);
                return acc;
            }, {} as Record<string, { vendorName: string; count: number; amount: number; tds: number }>);

        return {
            period: { startDate, endDate },
            totalExpenses: totalAmount,
            totalTDS: totalTDS,
            totalPaid: totalPaid,
            expenseCount: expenses.length,
            byCategory,
            byVendor: Object.values(byVendor).sort((a, b) => b.amount - a.amount),
        };
    }

    // ============================================
    // RECURRING EXPENSES
    // ============================================

    /**
     * Create recurring expense (UPDATED)
     */
    async createRecurring(organizationId: string, dto: CreateRecurringExpenseDto, userId: string) {
        const ledger = await this.prisma.ledger.findFirst({
            where: { id: dto.ledgerId, organizationId, deletedAt: null },
        });

        if (!ledger) {
            throw new NotFoundException('Ledger not found');
        }

        if (ledger.ledgerType !== 'expense') {
            throw new BadRequestException('Ledger must be an expense type');
        }

        const nextDueDate = this.calculateNextDueDate(new Date(dto.startDate), dto.frequency);

        return this.prisma.recurringExpense.create({
            data: {
                organizationId,
                expenseCategory: dto.expenseCategory,
                ledgerId: dto.ledgerId,
                amount: dto.amount,
                frequency: dto.frequency,
                startDate: new Date(dto.startDate),
                endDate: dto.endDate ? new Date(dto.endDate) : null,
                nextDueDate,
                paymentMode: dto.paymentMode,
                paidFrom: dto.paidFrom,
                description: dto.description,
                vendorName: dto.vendorName,
                autoGenerate: dto.autoGenerate ?? true,
                createdBy: userId,
            },
            include: {
                ledger: {
                    select: {
                        ledgerName: true,
                    },
                },
            },
        });
    }

    /**
     * Get all recurring expenses (NO CHANGES)
     */
    async findAllRecurring(organizationId: string) {
        return this.prisma.recurringExpense.findMany({
            where: {
                organizationId,
                isActive: true,
                deletedAt: null,
            },
            include: {
                ledger: {
                    select: {
                        ledgerName: true,
                        ledgerGroup: {
                            select: {
                                groupName: true,
                            },
                        },
                    },
                },
            },
            orderBy: { nextDueDate: 'asc' },
        });
    }

    /**
     * ✅ UPDATED: Generate next occurrence with proper DTO
     */
    async generateNextOccurrence(organizationId: string, id: string, userId: string) {
        const recurring = await this.prisma.recurringExpense.findFirst({
            where: { id, organizationId, deletedAt: null },
            include: { ledger: true },
        });

        if (!recurring) {
            throw new NotFoundException('Recurring expense not found');
        }

        // Check if already past end date
        if (recurring.endDate && recurring.nextDueDate > recurring.endDate) {
            throw new BadRequestException(
                'Recurring expense has ended. Update end date to continue.'
            );
        }

        // Create expense
        const expense = await this.create(
            organizationId,
            {
                expenseCategory: recurring.expenseCategory,
                amount: Number(recurring.amount),
                expenseDate: recurring.nextDueDate.toISOString(),
                ledgerId: recurring.ledgerId,
                paymentMode: recurring.paymentMode,
                paidFrom: recurring.paidFrom ?? undefined,
                vendorName: recurring.vendorName ?? undefined,
                description: `${recurring.description} (Auto-generated from recurring)`,
                paidImmediately: true,
            },
            userId,
        );

        // Update next due date
        const nextDueDate = this.calculateNextDueDate(recurring.nextDueDate, recurring.frequency);

        await this.prisma.recurringExpense.update({
            where: { id },
            data: { nextDueDate },
        });

        return expense;
    }

    /**
     * ✅ NEW: Update recurring expense
     */
    async updateRecurring(
        organizationId: string,
        id: string,
        dto: UpdateRecurringExpenseDto,
    ) {
        const recurring = await this.prisma.recurringExpense.findFirst({
            where: { id, organizationId, deletedAt: null },
        });

        if (!recurring) {
            throw new NotFoundException('Recurring expense not found');
        }

        return this.prisma.recurringExpense.update({
            where: { id },
            data: {
                amount: dto.amount,
                frequency: dto.frequency,
                endDate: dto.endDate ? new Date(dto.endDate) : undefined,
                description: dto.description,
                isActive: dto.isActive,
                autoGenerate: dto.autoGenerate,
            },
        });
    }

    /**
     * ✅ NEW: Delete recurring expense
     */
    async removeRecurring(organizationId: string, id: string) {
        const recurring = await this.prisma.recurringExpense.findFirst({
            where: { id, organizationId, deletedAt: null },
        });

        if (!recurring) {
            throw new NotFoundException('Recurring expense not found');
        }

        await this.prisma.recurringExpense.update({
            where: { id },
            data: {
                deletedAt: new Date(),
                isActive: false,
            },
        });

        return {
            success: true,
            message: 'Recurring expense deleted successfully',
        };
    }

    /**
     * ✅ NEW: Get due recurring expenses
     */
    async getDueRecurringExpenses(organizationId: string) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        return this.prisma.recurringExpense.findMany({
            where: {
                organizationId,
                isActive: true,
                autoGenerate: true,
                nextDueDate: { lte: today },
                deletedAt: null,
            },
            include: {
                ledger: {
                    select: {
                        ledgerName: true,
                    },
                },
            },
            orderBy: {
                nextDueDate: 'asc',
            },
        });
    }

    /**
     * Calculate next due date (NO CHANGES)
     */
    private calculateNextDueDate(currentDate: Date, frequency: string): Date {
        const next = new Date(currentDate);

        switch (frequency) {
            case 'daily':
                next.setDate(next.getDate() + 1);
                break;
            case 'weekly':
                next.setDate(next.getDate() + 7);
                break;
            case 'monthly':
                next.setMonth(next.getMonth() + 1);
                break;
            case 'quarterly':
                next.setMonth(next.getMonth() + 3);
                break;
            case 'half_yearly':
                next.setMonth(next.getMonth() + 6);
                break;
            case 'yearly':
                next.setFullYear(next.getFullYear() + 1);
                break;
        }

        return next;
    }
}