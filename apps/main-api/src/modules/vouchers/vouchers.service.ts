import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { prisma, Prisma } from '@textile/database';
import {
    CreateVoucherDto,
    UpdteVoucherDto,
    VoucherFiltersDto,
    CancelVoucherDto,
} from './dto';
import { VoucherGeneratorService } from './services/voucher-generator.service';

@Injectable()
export class VouchersService {
    constructor(
        private prisma: prisma.PrismaService,
        private voucherGenerator: VoucherGeneratorService,
    ) { }

    /**
     * Create new voucher with double entry validation
     */
    async create(organizationId: string, dto: CreateVoucherDto, userId: string) {
        // Validate minimum entries
        if (!dto.entries || dto.entries.length < 2) {
            throw new BadRequestException('Voucher must have at least 2 entries');
        }

        // Validate each entry
        const entryValidation = this.voucherGenerator.validateEntries(dto.entries);
        if (!entryValidation.isValid) {
            throw new BadRequestException(entryValidation.errors.join('; '));
        }

        // Validate double entry
        const doubleEntryValidation = this.voucherGenerator.validateDoubleEntry(dto.entries);
        if (!doubleEntryValidation.isValid) {
            throw new BadRequestException(
                `Double entry mismatch: Debit (₹${doubleEntryValidation.totalDebit}) ≠ Credit (₹${doubleEntryValidation.totalCredit}). Difference: ₹${doubleEntryValidation.difference}`,
            );
        }

        // Validate ledgers exist
        const ledgerIds = dto.entries.map((e) => e.ledgerId);
        const ledgerValidation = await this.voucherGenerator.validateLedgers(
            organizationId,
            ledgerIds,
        );
        if (!ledgerValidation.isValid) {
            throw new BadRequestException(
                `Invalid ledgers: ${ledgerValidation.missingLedgers.join(', ')}`,
            );
        }

        // Generate voucher number
        const voucherDate = new Date(dto.voucherDate);
        const voucherNumber = await this.voucherGenerator.generateVoucherNumber(
            organizationId,
            dto.voucherType,
            voucherDate,
        );

        try {
            const voucher = await this.prisma.$transaction(async (tx) => {
                // Create voucher
                const newVoucher = await tx.voucher.create({
                    data: {
                        organizationId,
                        voucherType: dto.voucherType,
                        voucherNumber,
                        voucherDate,
                        narration: dto.narration,
                        referenceType: dto.referenceType,
                        referenceId: dto.referenceId,
                        referenceNumber: dto.referenceNumber,
                        totalDebit: doubleEntryValidation.totalDebit,
                        totalCredit: doubleEntryValidation.totalCredit,
                        isPosted: true,
                        createdBy: userId,
                    },
                });

                // Create voucher entries and update ledger balances
                for (const entry of dto.entries) {
                    // Create entry
                    await tx.voucherEntry.create({
                        data: {
                            voucherId: newVoucher.id,
                            ledgerId: entry.ledgerId,
                            ledgerName: entry.ledgerName,
                            debitAmount: entry.debitAmount || 0,
                            creditAmount: entry.creditAmount || 0,
                            gstRate: entry.gstRate || null,
                            cgstAmount: entry.cgstAmount || null,
                            sgstAmount: entry.sgstAmount || null,
                            igstAmount: entry.igstAmount || null,
                            cessAmount: entry.cessAmount || null,
                            narration: entry.narration || null,
                        },
                    });

                    // Update ledger balance
                    const debit = Number(entry.debitAmount || 0);
                    const credit = Number(entry.creditAmount || 0);

                    if (debit > 0) {
                        await tx.ledger.update({
                            where: { id: entry.ledgerId },
                            data: {
                                currentBalance: {
                                    increment: debit,
                                },
                            },
                        });
                    } else if (credit > 0) {
                        await tx.ledger.update({
                            where: { id: entry.ledgerId },
                            data: {
                                currentBalance: {
                                    decrement: credit,
                                },
                            },
                        });
                    }
                }

                return newVoucher;
            });

            return this.findById(organizationId, voucher.id);
        } catch (error: any) {
            console.error('Voucher creation failed:', error);

            if (error instanceof BadRequestException) {
                throw error;
            }

            throw new BadRequestException(
                `Failed to create voucher: ${error.message || 'Unknown error occurred'}`
            );
        }
    }

    /**
     * Get all vouchers with filters
     */
    async findAll(organizationId: string, filters?: VoucherFiltersDto) {
        const {
            page = 1,
            limit = 50,
            search,
            voucherType,
            startDate,
            endDate,
            referenceType,
            referenceId,
            isPosted,
            isCancelled,
            sortBy = 'voucherDate',
            sortOrder = 'DESC',
        } = filters || {};

        const where: Prisma.VoucherWhereInput = {
            organizationId,
            deletedAt: null,
        };

        if (search) {
            where.OR = [
                { voucherNumber: { contains: search, mode: 'insensitive' } },
                { narration: { contains: search, mode: 'insensitive' } },
                { referenceNumber: { contains: search, mode: 'insensitive' } },
            ];
        }

        if (voucherType) {
            where.voucherType = voucherType;
        }

        if (startDate || endDate) {
            where.voucherDate = {};
            if (startDate) where.voucherDate.gte = new Date(startDate);
            if (endDate) where.voucherDate.lte = new Date(endDate);
        }

        if (referenceType) {
            where.referenceType = referenceType;
        }

        if (referenceId) {
            where.referenceId = referenceId;
        }

        if (isPosted !== undefined) {
            where.isPosted = isPosted;
        }

        if (isCancelled !== undefined) {
            where.isCancelled = isCancelled;
        }

        const [data, total] = await Promise.all([
            this.prisma.voucher.findMany({
                where,
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
                        orderBy: {
                            createdAt: 'asc',
                        },
                    },
                },
                orderBy: { [sortBy]: sortOrder.toLowerCase() },
                skip: (page - 1) * limit,
                take: limit,
            }),
            this.prisma.voucher.count({ where }),
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
     * Get voucher by ID
     */
    async findById(organizationId: string, id: string) {
        const voucher = await this.prisma.voucher.findFirst({
            where: {
                id,
                organizationId,
                deletedAt: null,
            },
            include: {
                entries: {
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
                    },
                    orderBy: {
                        createdAt: 'asc',
                    },
                },
            },
        });

        if (!voucher) {
            throw new NotFoundException('Voucher not found');
        }

        return voucher;
    }

    /**
     * Update voucher (only if not cancelled)
     */
    async update(
        organizationId: string,
        id: string,
        dto: UpdteVoucherDto,
        userId: string,
    ) {
        const voucher = await this.findById(organizationId, id);

        if (voucher.isCancelled) {
            throw new BadRequestException('Cannot update cancelled voucher');
        }

        // If updating entries, validate them
        if (dto.entries) {
            if (dto.entries.length < 2) {
                throw new BadRequestException('Voucher must have at least 2 entries');
            }

            const entryValidation = this.voucherGenerator.validateEntries(dto.entries);
            if (!entryValidation.isValid) {
                throw new BadRequestException(entryValidation.errors.join('; '));
            }

            const doubleEntryValidation = this.voucherGenerator.validateDoubleEntry(dto.entries);
            if (!doubleEntryValidation.isValid) {
                throw new BadRequestException(
                    `Double entry mismatch: Debit (₹${doubleEntryValidation.totalDebit}) ≠ Credit (₹${doubleEntryValidation.totalCredit})`,
                );
            }

            const ledgerIds = dto.entries.map((e: any) => e.ledgerId);
            const ledgerValidation = await this.voucherGenerator.validateLedgers(
                organizationId,
                ledgerIds,
            );
            if (!ledgerValidation.isValid) {
                throw new BadRequestException(
                    `Invalid ledgers: ${ledgerValidation.missingLedgers.join(', ')}`,
                );
            }
        }

        return this.prisma.$transaction(async (tx) => {
            // If entries are being updated and voucher is posted, reverse old entries first
            if (dto.entries && voucher.isPosted) {
                // Reverse old ledger balances
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

                // Delete old entries
                await tx.voucherEntry.deleteMany({
                    where: { voucherId: id },
                });

                // Create new entries and update ledger balances
                for (const entry of dto.entries) {
                    await tx.voucherEntry.create({
                        data: {
                            voucherId: id,
                            ledgerId: entry.ledgerId,
                            ledgerName: entry.ledgerName,
                            debitAmount: entry.debitAmount || 0,
                            creditAmount: entry.creditAmount || 0,
                            gstRate: entry.gstRate || null,
                            cgstAmount: entry.cgstAmount || null,
                            sgstAmount: entry.sgstAmount || null,
                            igstAmount: entry.igstAmount || null,
                            cessAmount: entry.cessAmount || null,
                            narration: entry.narration || null,
                        },
                    });

                    const debit = Number(entry.debitAmount || 0);
                    const credit = Number(entry.creditAmount || 0);

                    if (debit > 0) {
                        await tx.ledger.update({
                            where: { id: entry.ledgerId },
                            data: {
                                currentBalance: {
                                    increment: debit,
                                },
                            },
                        });
                    } else if (credit > 0) {
                        await tx.ledger.update({
                            where: { id: entry.ledgerId },
                            data: {
                                currentBalance: {
                                    decrement: credit,
                                },
                            },
                        });
                    }
                }
            }

            // Update voucher
            const validation = dto.entries
                ? this.voucherGenerator.validateDoubleEntry(dto.entries)
                : null;

            return tx.voucher.update({
                where: { id },
                data: {
                    voucherDate: dto.voucherDate ? new Date(dto.voucherDate) : undefined,
                    narration: dto.narration,
                    referenceType: dto.referenceType,
                    referenceId: dto.referenceId,
                    referenceNumber: dto.referenceNumber,
                    totalDebit: validation?.totalDebit,
                    totalCredit: validation?.totalCredit,
                    isPosted: dto.isPosted,
                    editedBy: userId,
                    editedAt: new Date(),
                },
                include: {
                    entries: {
                        include: {
                            ledger: true,
                        },
                    },
                },
            });
        });
    }

    /**
     * Cancel voucher (reverse all entries)
     */
    async cancel(
        organizationId: string,
        id: string,
        dto: CancelVoucherDto,
        userId: string,
    ) {
        const voucher = await this.findById(organizationId, id);

        if (voucher.isCancelled) {
            throw new BadRequestException('Voucher already cancelled');
        }

        if (!voucher.isPosted) {
            throw new BadRequestException('Can only cancel posted vouchers');
        }

        return this.prisma.$transaction(async (tx) => {
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

            // Mark voucher as cancelled
            return tx.voucher.update({
                where: { id },
                data: {
                    isCancelled: true,
                    cancelledAt: new Date(),
                    cancelledBy: userId,
                    cancellationReason: dto.reason,
                },
                include: {
                    entries: {
                        include: {
                            ledger: true,
                        },
                    },
                },
            });
        });
    }

    /**
     * Delete voucher (soft delete - only if not posted)
     */
    async remove(organizationId: string, id: string) {
        const voucher = await this.findById(organizationId, id);

        if (voucher.isPosted) {
            throw new BadRequestException(
                'Cannot delete posted voucher. Please cancel it instead.',
            );
        }

        await this.prisma.voucher.update({
            where: { id },
            data: {
                deletedAt: new Date(),
            },
        });

        return { success: true, message: 'Voucher deleted successfully' };
    }

    /**
     * Get day book (all vouchers for a date range)
     */
    async getDayBook(organizationId: string, startDate: Date, endDate: Date) {
        const vouchers = await this.prisma.voucher.findMany({
            where: {
                organizationId,
                voucherDate: {
                    gte: startDate,
                    lte: endDate,
                },
                isPosted: true,
                isCancelled: false,
                deletedAt: null,
            },
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
                    orderBy: {
                        createdAt: 'asc',
                    },
                },
            },
            orderBy: [{ voucherDate: 'asc' }, { voucherNumber: 'asc' }],
        });

        const summary = {
            totalVouchers: vouchers.length,
            totalDebit: vouchers.reduce((sum, v) => sum + Number(v.totalDebit), 0),
            totalCredit: vouchers.reduce((sum, v) => sum + Number(v.totalCredit), 0),
            byType: {} as Record<string, { count: number; debit: number; credit: number }>,
        };

        vouchers.forEach((v) => {
            if (!summary.byType[v.voucherType]) {
                summary.byType[v.voucherType] = { count: 0, debit: 0, credit: 0 };
            }
            summary.byType[v.voucherType].count += 1;
            summary.byType[v.voucherType].debit += Number(v.totalDebit);
            summary.byType[v.voucherType].credit += Number(v.totalCredit);
        });

        return {
            vouchers,
            summary,
            period: {
                startDate,
                endDate,
            },
        };
    }

    /**
     * Get vouchers by reference (e.g., all vouchers for an invoice)
     */
    async getByReference(organizationId: string, referenceType: string, referenceId: string) {
        return this.prisma.voucher.findMany({
            where: {
                organizationId,
                referenceType,
                referenceId,
                deletedAt: null,
            },
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
            orderBy: {
                voucherDate: 'desc',
            },
        });
    }
}