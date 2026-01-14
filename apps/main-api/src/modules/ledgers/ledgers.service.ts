import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { LedgerType, prisma, Prisma } from '@textile/database';
import { CreateLedgerDto, UpdateLedgerDto, LedgerFiltersDto } from './dto';

@Injectable()
export class LedgersService {
    constructor(private prisma: prisma.PrismaService) { }

    /**
     * ✅ UPDATED: Create manual ledger with proper validations
     */
    async create(organizationId: string, dto: CreateLedgerDto, userId: string) {
        // ✅ Case-insensitive duplicate check
        const existing = await this.prisma.ledger.findFirst({
            where: {
                organizationId,
                ledgerName: {
                    equals: dto.ledgerName,
                    mode: 'insensitive',
                },
                deletedAt: null,
            },
        });

        if (existing) {
            throw new BadRequestException(
                `Ledger "${dto.ledgerName}" already exists. Please use a different name.`
            );
        }

        // Validate ledger group exists
        const ledgerGroup = await this.prisma.ledgerGroup.findFirst({
            where: {
                id: dto.ledgerGroupId,
                organizationId,
                deletedAt: null,
            },
        });

        if (!ledgerGroup) {
            throw new NotFoundException('Ledger group not found');
        }

        // ✅ Validate ledger type matches group type
        const compatibilityMap: Record<string, string[]> = {
            party_receivable: ['current_assets'],
            party_payable: ['current_liabilities'],
            cash: ['current_assets'],
            bank: ['current_assets'],
            sales: ['sales_accounts'],
            sales_return: ['sales_accounts'],
            purchase: ['purchase_accounts'],
            purchase_return: ['purchase_accounts'],
            expense: ['direct_expenses', 'indirect_expenses'],
            income: ['direct_incomes', 'indirect_incomes'],
            gst_input: ['current_assets'],
            gst_output: ['current_liabilities'],
            asset: ['current_assets', 'fixed_assets'],
            liability: ['current_liabilities', 'loans_liability'],
            capital: ['capital_account'],
            round_off: ['sales_accounts', 'indirect_expenses'],
        };

        const allowedGroupTypes = compatibilityMap[dto.ledgerType];
        if (allowedGroupTypes && !allowedGroupTypes.includes(ledgerGroup.groupType)) {
            throw new BadRequestException(
                `Ledger type "${dto.ledgerType}" cannot be placed under group type "${ledgerGroup.groupType}". ` +
                `Allowed groups: ${allowedGroupTypes.join(', ')}`
            );
        }

        // ✅ If party ledger, validate party exists and doesn't have ledger already
        if (dto.partyId) {
            const party = await this.prisma.party.findFirst({
                where: {
                    id: dto.partyId,
                    organizationId,
                    deletedAt: null,
                },
                include: {
                    ledger: true,
                },
            });

            if (!party) {
                throw new NotFoundException('Party not found');
            }

            if (party.ledger) {
                throw new BadRequestException(
                    `Party "${party.businessName}" already has a ledger: "${party.ledger.ledgerName}"`
                );
            }

            // ✅ Validate ledger type matches party type
            const expectedType = party.partyType === 'customer' ? 'party_receivable' : 'party_payable';
            if (dto.ledgerType !== expectedType) {
                throw new BadRequestException(
                    `For ${party.partyType}, ledger type must be "${expectedType}"`
                );
            }
        }

        // ✅ If bank ledger, validate required bank details
        if (dto.ledgerType === 'bank') {
            if (!dto.accountNumber || !dto.ifscCode) {
                throw new BadRequestException(
                    'Bank ledgers require accountNumber and ifscCode'
                );
            }
        }

        // ✅ If GST ledger, validate tax details
        if (dto.ledgerType === 'gst_input' || dto.ledgerType === 'gst_output') {
            if (!dto.taxType) {
                throw new BadRequestException(
                    'GST ledgers require taxType (CGST, SGST, IGST, or CESS)'
                );
            }

            const validTaxTypes = ['CGST', 'SGST', 'IGST', 'CESS'];
            if (!validTaxTypes.includes(dto.taxType)) {
                throw new BadRequestException(
                    `Invalid taxType. Must be one of: ${validTaxTypes.join(', ')}`
                );
            }
        }

        // Create ledger
        return this.prisma.ledger.create({
            data: {
                organizationId,
                ledgerName: dto.ledgerName,
                ledgerCode: dto.ledgerCode,
                ledgerType: dto.ledgerType,
                ledgerGroupId: dto.ledgerGroupId,
                openingBalance: dto.openingBalance || 0,
                openingDate: dto.openingDate ? new Date(dto.openingDate) : new Date(),
                currentBalance: dto.openingBalance || 0,
                partyId: dto.partyId || null,
                bankName: dto.bankName || null,
                accountNumber: dto.accountNumber || null,
                ifscCode: dto.ifscCode || null,
                branchName: dto.branchName || null,
                taxType: dto.taxType || null,
                taxRate: dto.taxRate || null,
                description: dto.description || null,
                isSystemLedger: false,
                isActive: true,
                createdBy: userId,
            },
            include: {
                ledgerGroup: {
                    select: {
                        groupName: true,
                        groupType: true,
                        affects: true,
                    },
                },
                party: {
                    select: {
                        businessName: true,
                        partyCode: true,
                        phone: true,
                    },
                },
            },
        });
    }

    /**
     * Get all ledgers with filters (NO CHANGES - Already correct)
     */
    async findAll(organizationId: string, filters?: LedgerFiltersDto) {
        const {
            page = 1,
            limit = 50,
            search,
            ledgerType,
            ledgerGroupId,
            isSystemLedger,
            isActive,
            sortBy = 'ledgerName',
            sortOrder = 'ASC',
        } = filters || {};

        const where: Prisma.LedgerWhereInput = {
            organizationId,
            deletedAt: null,
        };

        if (search) {
            where.OR = [
                { ledgerName: { contains: search, mode: 'insensitive' } },
                { ledgerCode: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } },
            ];
        }

        if (ledgerType) {
            where.ledgerType = ledgerType;
        }

        if (ledgerGroupId) {
            where.ledgerGroupId = ledgerGroupId;
        }

        if (isSystemLedger !== undefined) {
            where.isSystemLedger = isSystemLedger;
        }

        if (isActive !== undefined) {
            where.isActive = isActive;
        }

        const [data, total] = await Promise.all([
            this.prisma.ledger.findMany({
                where,
                include: {
                    ledgerGroup: {
                        select: {
                            groupName: true,
                            groupType: true,
                            affects: true,
                        },
                    },
                    party: {
                        select: {
                            businessName: true,
                            partyCode: true,
                            phone: true,
                        },
                    },
                    _count: {
                        select: {
                            entries: true,
                        },
                    },
                },
                orderBy: { [sortBy]: sortOrder.toLowerCase() },
                skip: (page - 1) * limit,
                take: limit,
            }),
            this.prisma.ledger.count({ where }),
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
     * Get ledger by ID (NO CHANGES - Already correct)
     */
    async findById(organizationId: string, id: string) {
        const ledger = await this.prisma.ledger.findFirst({
            where: {
                id,
                organizationId,
                deletedAt: null,
            },
            include: {
                ledgerGroup: true,
                party: true,
                entries: {
                    include: {
                        voucher: {
                            select: {
                                voucherNumber: true,
                                voucherType: true,
                                voucherDate: true,
                                narration: true,
                            },
                        },
                    },
                    orderBy: {
                        createdAt: 'desc',
                    },
                    take: 50,
                },
                _count: {
                    select: {
                        entries: true,
                    },
                },
            },
        });

        if (!ledger) {
            throw new NotFoundException('Ledger not found');
        }

        return ledger;
    }

    /**
     * ✅ COMPLETELY REWRITTEN: Update ledger with strict validations
     */
    async update(organizationId: string, id: string, dto: UpdateLedgerDto) {
        const ledger = await this.findById(organizationId, id);

        // ✅ RULE 1: System ledgers cannot be edited at all
        if (ledger.isSystemLedger) {
            throw new BadRequestException(
                'System ledgers cannot be modified. They are auto-managed by the application.'
            );
        }

        // ✅ RULE 2: Check if ledger has transactions
        const entriesCount = ledger._count?.entries || 0;
        const hasTransactions = entriesCount > 0;

        // ✅ RULE 3: If has transactions, restrict critical field changes
        if (hasTransactions) {
            const restrictedFields = [
                'ledgerType',
                'ledgerGroupId',
                'partyId',
                'taxType',
                'taxRate',
            ];

            const attemptedChanges = Object.keys(dto).filter((key) =>
                restrictedFields.includes(key)
            );

            if (attemptedChanges.length > 0) {
                throw new BadRequestException(
                    `Cannot change ${attemptedChanges.join(', ')} for ledger with ${entriesCount} existing transactions. ` +
                    `Create a new ledger instead.`
                );
            }
        }

        // ✅ RULE 4: Name change - check for duplicates (case-insensitive)
        if (dto.ledgerName) {
            const existing = await this.prisma.ledger.findFirst({
                where: {
                    organizationId,
                    ledgerName: {
                        equals: dto.ledgerName,
                        mode: 'insensitive',
                    },
                    id: { not: id },
                    deletedAt: null,
                },
            });

            if (existing) {
                throw new BadRequestException(
                    `Ledger name "${dto.ledgerName}" is already in use`
                );
            }
        }

        // ✅ RULE 5: If updating ledger group, validate compatibility
        if (dto.ledgerGroupId) {
            const newGroup = await this.prisma.ledgerGroup.findFirst({
                where: {
                    id: dto.ledgerGroupId,
                    organizationId,
                    deletedAt: null,
                },
            });

            if (!newGroup) {
                throw new NotFoundException('Ledger group not found');
            }

            // Validate type compatibility
            const compatibilityMap: Record<string, string[]> = {
                party_receivable: ['current_assets'],
                party_payable: ['current_liabilities'],
                cash: ['current_assets'],
                bank: ['current_assets'],
                sales: ['sales_accounts'],
                sales_return: ['sales_accounts'],
                purchase: ['purchase_accounts'],
                purchase_return: ['purchase_accounts'],
                expense: ['direct_expenses', 'indirect_expenses'],
                income: ['direct_incomes', 'indirect_incomes'],
                gst_input: ['current_assets'],
                gst_output: ['current_liabilities'],
                asset: ['current_assets', 'fixed_assets'],
                liability: ['current_liabilities', 'loans_liability'],
                capital: ['capital_account'],
                round_off: ['sales_accounts', 'indirect_expenses'],
            };

            const allowedGroupTypes = compatibilityMap[ledger.ledgerType];
            if (allowedGroupTypes && !allowedGroupTypes.includes(newGroup.groupType)) {
                throw new BadRequestException(
                    `Ledger type "${ledger.ledgerType}" cannot be moved to group type "${newGroup.groupType}". ` +
                    `Allowed groups: ${allowedGroupTypes.join(', ')}`
                );
            }
        }

        // ✅ RULE 6: Opening balance can only change if no transactions
        if (dto.openingBalance !== undefined && hasTransactions) {
            throw new BadRequestException(
                'Cannot change opening balance for ledger with transactions. ' +
                'Use a journal voucher to adjust instead.'
            );
        }

        // ✅ Perform update
        return this.prisma.ledger.update({
            where: { id },
            data: {
                ledgerName: dto.ledgerName,
                ledgerCode: dto.ledgerCode,
                ledgerGroupId: dto.ledgerGroupId,
                openingBalance: dto.openingBalance,
                openingDate: dto.openingDate ? new Date(dto.openingDate) : undefined,
                bankName: dto.bankName,
                accountNumber: dto.accountNumber,
                ifscCode: dto.ifscCode,
                branchName: dto.branchName,
                description: dto.description,
                isActive: dto.isActive,
            },
            include: {
                ledgerGroup: true,
                party: true,
            },
        });
    }

    /**
     * ✅ UPDATED: Delete ledger with proper checks
     */
    async remove(organizationId: string, id: string) {
        const ledger = await this.findById(organizationId, id);

        // ✅ RULE 1: Cannot delete system ledgers
        if (ledger.isSystemLedger) {
            throw new BadRequestException(
                'System ledgers cannot be deleted. Deactivate instead if needed.'
            );
        }

        // ✅ RULE 2: Cannot delete if has voucher entries
        const entriesCount = ledger._count?.entries || 0;
        if (entriesCount > 0) {
            throw new BadRequestException(
                `Cannot delete ledger with ${entriesCount} voucher entries. ` +
                `Deactivate the ledger instead to prevent new transactions.`
            );
        }

        // ✅ RULE 3: If party ledger, check if party has invoices/payments
        if (ledger.partyId) {
            const [invoiceCount, paymentCount] = await Promise.all([
                this.prisma.invoice.count({
                    where: { partyId: ledger.partyId },
                }),
                this.prisma.payment.count({
                    where: { partyId: ledger.partyId },
                }),
            ]);

            if (invoiceCount > 0 || paymentCount > 0) {
                throw new BadRequestException(
                    `Cannot delete party ledger with ${invoiceCount} invoices and ${paymentCount} payments. ` +
                    `Delete party transactions first.`
                );
            }
        }

        // ✅ Soft delete
        await this.prisma.ledger.update({
            where: { id },
            data: {
                deletedAt: new Date(),
                isActive: false,
            },
        });

        return {
            success: true,
            message: 'Ledger deleted successfully',
        };
    }

    /**
     * ✅ NEW: Deactivate ledger (better than delete)
     */
    async deactivate(organizationId: string, id: string) {
        const ledger = await this.findById(organizationId, id);

        if (ledger.isSystemLedger) {
            throw new BadRequestException('Cannot deactivate system ledgers');
        }

        await this.prisma.ledger.update({
            where: { id },
            data: { isActive: false },
        });

        return {
            success: true,
            message: `Ledger "${ledger.ledgerName}" deactivated. No new transactions will be allowed.`,
        };
    }

    /**
     * Get ledger statement (NO CHANGES - Already correct)
     */
    async getLedgerStatement(
        organizationId: string,
        ledgerId: string,
        startDate?: Date,
        endDate?: Date,
    ) {
        const ledger = await this.findById(organizationId, ledgerId);

        const where: any = {
            ledgerId,
            voucher: {
                organizationId,
                isPosted: true,
                isCancelled: false,
            },
        };

        if (startDate || endDate) {
            where.voucher.voucherDate = {};
            if (startDate) where.voucher.voucherDate.gte = startDate;
            if (endDate) where.voucher.voucherDate.lte = endDate;
        }

        const entries = await this.prisma.voucherEntry.findMany({
            where,
            include: {
                voucher: {
                    select: {
                        voucherNumber: true,
                        voucherType: true,
                        voucherDate: true,
                        narration: true,
                        referenceType: true,
                        referenceNumber: true,
                    },
                },
            },
            orderBy: [{ voucher: { voucherDate: 'asc' } }, { createdAt: 'asc' }],
        });

        // Calculate running balance
        let runningBalance = Number(ledger.openingBalance);
        const statement = entries.map((entry) => {
            const debit = Number(entry.debitAmount);
            const credit = Number(entry.creditAmount);

            runningBalance += debit - credit;

            return {
                date: entry.voucher.voucherDate,
                voucherNumber: entry.voucher.voucherNumber,
                voucherType: entry.voucher.voucherType,
                referenceType: entry.voucher.referenceType,
                referenceNumber: entry.voucher.referenceNumber,
                narration: entry.voucher.narration || entry.narration,
                debit,
                credit,
                balance: runningBalance,
            };
        });

        return {
            ledger: {
                id: ledger.id,
                name: ledger.ledgerName,
                type: ledger.ledgerType,
                group: ledger.ledgerGroup.groupName,
                openingBalance: Number(ledger.openingBalance),
                currentBalance: Number(ledger.currentBalance),
            },
            statement,
            summary: {
                totalDebit: entries.reduce((sum, e) => sum + Number(e.debitAmount), 0),
                totalCredit: entries.reduce((sum, e) => sum + Number(e.creditAmount), 0),
                closingBalance: runningBalance,
            },
        };
    }

    /**
     * ⚠️ DEPRECATED: Direct balance updates (will be removed in v2.0)
     * 
     * WARNING: This method violates double-entry accounting principles.
     * Balances should ONLY update through voucher entries.
     * 
     * @deprecated Use VouchersService.create() instead
     */
    async updateBalance(ledgerId: string, amount: number, isDebit: boolean) {
        console.warn(
            '⚠️ DEPRECATED: ledgersService.updateBalance() bypasses double-entry accounting. ' +
            'Use VouchersService.create() to properly record transactions.'
        );

        // Still allow for backward compatibility
        return this.prisma.ledger.update({
            where: { id: ledgerId },
            data: {
                currentBalance: {
                    [isDebit ? 'increment' : 'decrement']: amount,
                },
            },
        });
    }

    /**
     * ✅ NEW: Get ledgers by type (useful for dropdowns)
     */
    async findByType(organizationId: string, ledgerType: LedgerType) {
        return this.prisma.ledger.findMany({
            where: {
                organizationId,
                ledgerType,
                isActive: true,
                deletedAt: null,
            },
            select: {
                id: true,
                ledgerName: true,
                ledgerCode: true,
                currentBalance: true,
            },
            orderBy: {
                ledgerName: 'asc',
            },
        });
    }

    async search(organizationId: string, query: string, limit: number = 10) {
        return this.prisma.ledger.findMany({
            where: {
                organizationId,
                isActive: true,
                deletedAt: null,
                OR: [
                    { ledgerName: { contains: query, mode: 'insensitive' } },
                    { ledgerCode: { contains: query, mode: 'insensitive' } },
                ],
            },
            select: {
                id: true,
                ledgerName: true,
                ledgerCode: true,
                ledgerType: true,
                currentBalance: true,
                ledgerGroup: {
                    select: {
                        groupName: true,
                    },
                },
            },
            take: limit,
            orderBy: {
                ledgerName: 'asc' as const,
            },
        });
    }
}