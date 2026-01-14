import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PartyType, prisma, Prisma } from '@textile/database';
import { CreatePartyDto, UpdatePartyDto, PartyFiltersDto } from './dto';
import { LedgerSetupService } from '../vouchers/services/ledger-setup.service';

@Injectable()
export class PartiesService {
    constructor(
        private prisma: prisma.PrismaService,
        private ledgerSetupService: LedgerSetupService,
    ) { }

    /**
     * ✅ UPDATED: Create party with auto-ledger creation and opening balance voucher
     */
    async create(organizationId: string, dto: CreatePartyDto, userId: string) {
        // ✅ Validate GSTIN format if provided
        if (dto.gstin) {
            const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
            if (!gstinRegex.test(dto.gstin)) {
                throw new BadRequestException(
                    'Invalid GSTIN format. Expected: 22AAAAA0000A1Z5'
                );
            }

            // ✅ Check for duplicate GSTIN
            const existingGstin = await this.prisma.party.findFirst({
                where: {
                    organizationId,
                    gstin: dto.gstin,
                    deletedAt: null,
                },
            });

            if (existingGstin) {
                throw new BadRequestException(
                    `Party with GSTIN "${dto.gstin}" already exists: ${existingGstin.businessName}`
                );
            }
        }

        // ✅ Validate PAN format if provided
        if (dto.pan) {
            const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
            if (!panRegex.test(dto.pan)) {
                throw new BadRequestException(
                    'Invalid PAN format. Expected: ABCDE1234F'
                );
            }
        }

        // ✅ Check for duplicate phone
        const existingPhone = await this.prisma.party.findFirst({
            where: {
                organizationId,
                phone: dto.phone,
                deletedAt: null,
            },
        });

        if (existingPhone) {
            throw new BadRequestException(
                `Party with phone "${dto.phone}" already exists: ${existingPhone.businessName}`
            );
        }

        // Generate party code
        const count = await this.prisma.party.count({
            where: {
                organizationId,
                partyType: dto.partyType,
            },
        });

        const prefix = dto.partyType === 'customer' ? 'CUST' :
            dto.partyType === 'supplier' ? 'SUPP' : 'BOTH';
        const partyCode = `${prefix}${String(count + 1).padStart(4, '0')}`;

        return this.prisma.$transaction(async (tx) => {
            // ✅ Get appropriate ledger group
            const groupName = dto.partyType === 'customer' || dto.partyType === 'both'
                ? 'Sundry Debtors'
                : 'Sundry Creditors';

            const ledgerGroup = await tx.ledgerGroup.findFirst({
                where: {
                    organizationId,
                    groupName,
                    deletedAt: null,
                },
            });

            if (!ledgerGroup) {
                throw new BadRequestException(
                    `Ledger group "${groupName}" not found. Please run default ledger setup first.`
                );
            }

            // ✅ Determine ledger type
            const ledgerType = dto.partyType === 'customer'
                ? 'party_receivable'
                : dto.partyType === 'supplier'
                    ? 'party_payable'
                    : 'party_receivable'; // For 'both', default to receivable

            // ✅ CREATE PARTY LEDGER FIRST
            const ledger = await tx.ledger.create({
                data: {
                    organizationId,
                    ledgerName: dto.businessName,
                    ledgerCode: partyCode,
                    ledgerType,
                    ledgerGroupId: ledgerGroup.id,
                    openingBalance: dto.openingBalance || 0,
                    openingDate: new Date(),
                    currentBalance: dto.openingBalance || 0,
                    isSystemLedger: false,
                    isActive: true,
                    createdBy: userId,
                    description: `Party ledger for ${dto.businessName}`,
                },
            });

            // ✅ CREATE PARTY WITH LEDGER LINK
            const party = await tx.party.create({
                data: {
                    organizationId,
                    partyType: dto.partyType,
                    partyCode,
                    businessName: dto.businessName,
                    contactPerson: dto.contactPerson,
                    phone: dto.phone,
                    email: dto.email,
                    whatsappNumber: dto.whatsappNumber || dto.phone,
                    addressLine1: dto.addressLine1,
                    addressLine2: dto.addressLine2,
                    city: dto.city,
                    state: dto.state,
                    pincode: dto.pincode,
                    gstin: dto.gstin,
                    pan: dto.pan,
                    openingBalance: dto.openingBalance || 0,
                    creditLimit: dto.creditLimit || 0,
                    creditDays: dto.creditDays || 0,
                    notes: dto.notes,
                    tags: dto.tags || [],
                    ledgerId: ledger.id,
                    createdBy: userId,
                },
            });

            await tx.ledger.update({
                where: { id: ledger.id },
                data: { partyId: party.id },
            });

            // ✅ Create opening balance voucher if non-zero
            if (dto.openingBalance && dto.openingBalance !== 0) {
                await this.createOpeningBalanceVoucher(
                    tx,
                    organizationId,
                    party,
                    ledger,
                    dto.openingBalance,
                    userId,
                );
            }

            return party;
        });
    }

    /**
     * ✅ UPDATED: Create opening balance voucher with proper accounting
     */
    private async createOpeningBalanceVoucher(
        tx: any,
        organizationId: string,
        party: any,
        partyLedger: any,
        openingBalance: number,
        userId: string,
    ) {
        // Get capital account ledger
        const capitalLedger = await tx.ledger.findFirst({
            where: {
                organizationId,
                ledgerName: 'Capital Account',
                isSystemLedger: true,
                deletedAt: null,
            },
        });

        if (!capitalLedger) {
            throw new BadRequestException(
                'Capital Account ledger not found. Please run default ledger setup first.'
            );
        }

        // ✅ Determine debit/credit based on party type and balance sign
        const isCustomer = party.partyType === 'customer' || party.partyType === 'both';
        const isPositiveBalance = openingBalance > 0;

        /**
         * ACCOUNTING LOGIC:
         * Customer with +ve balance (they owe us):
         *   Dr. Customer (Asset) | Cr. Capital Account
         * 
         * Customer with -ve balance (we owe them - advance received):
         *   Dr. Capital Account | Cr. Customer (Liability)
         * 
         * Supplier with +ve balance (we owe them):
         *   Dr. Capital Account | Cr. Supplier (Liability)
         * 
         * Supplier with -ve balance (they owe us - advance paid):
         *   Dr. Supplier (Asset) | Cr. Capital Account
         */

        let partyDebit = 0;
        let partyCredit = 0;
        let capitalDebit = 0;
        let capitalCredit = 0;

        if (isCustomer) {
            if (isPositiveBalance) {
                // Customer owes us
                partyDebit = Math.abs(openingBalance);
                capitalCredit = Math.abs(openingBalance);
            } else {
                // We owe customer (advance received)
                partyCredit = Math.abs(openingBalance);
                capitalDebit = Math.abs(openingBalance);
            }
        } else {
            // Supplier
            if (isPositiveBalance) {
                // We owe supplier
                partyCredit = Math.abs(openingBalance);
                capitalDebit = Math.abs(openingBalance);
            } else {
                // Supplier owes us (advance paid)
                partyDebit = Math.abs(openingBalance);
                capitalCredit = Math.abs(openingBalance);
            }
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
        const voucher = await tx.voucher.create({
            data: {
                organizationId,
                voucherType: 'journal',
                voucherNumber,
                voucherDate: now,
                narration: `Opening balance for ${party.businessName} (${party.partyType}) as on ${now.toLocaleDateString('en-IN')}`,
                referenceType: 'party_opening',
                referenceId: party.id,
                referenceNumber: party.partyCode,
                totalDebit: Math.abs(openingBalance),
                totalCredit: Math.abs(openingBalance),
                isPosted: true,
                createdBy: userId,
            },
        });

        // Create voucher entries
        const entries = [
            {
                ledgerId: partyLedger.id,
                ledgerName: partyLedger.ledgerName,
                debitAmount: partyDebit,
                creditAmount: partyCredit,
                narration: `Opening balance - ${isPositiveBalance ? 'Receivable' : 'Payable'}`,
            },
            {
                ledgerId: capitalLedger.id,
                ledgerName: capitalLedger.ledgerName,
                debitAmount: capitalDebit,
                creditAmount: capitalCredit,
                narration: 'Contra entry for opening balance',
            },
        ];

        for (const entry of entries) {
            await tx.voucherEntry.create({
                data: {
                    voucherId: voucher.id,
                    ...entry,
                },
            });
        }

        console.log(
            `✅ Opening balance voucher created: ${voucherNumber} | ` +
            `${party.businessName} (${isPositiveBalance ? 'Dr' : 'Cr'}) ₹${Math.abs(openingBalance)}`
        );
    }

    /**
     * Get all parties with filters (NO CHANGES - Already correct)
     */
    async findAll(organizationId: string, filters: PartyFiltersDto) {
        const {
            page = 1,
            limit = 20,
            partyType,
            search,
            sortBy = 'createdAt',
            sortOrder = 'DESC',
        } = filters;

        const where: Prisma.PartyWhereInput = {
            organizationId,
            isActive: true,
            deletedAt: null,
        };

        if (partyType) {
            where.partyType = partyType;
        }

        if (search) {
            where.OR = [
                { businessName: { contains: search, mode: 'insensitive' } },
                { phone: { contains: search } },
                { partyCode: { contains: search } },
                { gstin: { contains: search } },
                { email: { contains: search, mode: 'insensitive' } },
            ];
        }

        const [data, total] = await Promise.all([
            this.prisma.party.findMany({
                where,
                include: {
                    ledger: {
                        select: {
                            currentBalance: true,
                            openingBalance: true,
                        },
                    },
                    _count: {
                        select: {
                            invoices: true,
                            payments: true,
                        },
                    },
                },
                orderBy: { [sortBy]: sortOrder.toLowerCase() },
                skip: (page - 1) * limit,
                take: limit,
            }),
            this.prisma.party.count({ where }),
        ]);

        // Map ledger balance to party for API response
        const dataWithBalance = data.map((party) => ({
            ...party,
            currentBalance: party.ledger?.currentBalance || 0,
            openingBalance: party.ledger?.openingBalance || 0,
            transactionCount: party._count.invoices + party._count.payments,
        }));

        return {
            data: dataWithBalance,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
    }

    /**
     * Search parties (autocomplete) (NO CHANGES - Already correct)
     */
    async search(organizationId: string, query: string) {
        const parties = await this.prisma.party.findMany({
            where: {
                organizationId,
                isActive: true,
                deletedAt: null,
                OR: [
                    { businessName: { contains: query, mode: 'insensitive' } },
                    { phone: { contains: query } },
                    { partyCode: { contains: query } },
                    { gstin: { contains: query } },
                ],
            },
            include: {
                ledger: {
                    select: {
                        currentBalance: true,
                    },
                },
            },
            take: 10,
            orderBy: {
                businessName: 'asc',
            },
        });

        return parties.map((party) => ({
            id: party.id,
            partyCode: party.partyCode,
            businessName: party.businessName,
            partyType: party.partyType,
            phone: party.phone,
            gstin: party.gstin,
            currentBalance: party.ledger?.currentBalance || 0,
        }));
    }

    /**
     * Get party by ID (NO CHANGES - Already correct)
     */
    async findById(organizationId: string, id: string) {
        const party = await this.prisma.party.findFirst({
            where: {
                id,
                organizationId,
                deletedAt: null,
            },
            include: {
                ledger: {
                    select: {
                        id: true,
                        ledgerName: true,
                        currentBalance: true,
                        openingBalance: true,
                    },
                },
                _count: {
                    select: {
                        invoices: true,
                        payments: true,
                    },
                },
            },
        });

        if (!party) {
            throw new NotFoundException('Party not found');
        }

        return {
            ...party,
            currentBalance: party.ledger?.currentBalance || 0,
            openingBalance: party.ledger?.openingBalance || 0,
        };
    }

    /**
     * Get party ledger with transactions (NO CHANGES - Already correct)
     */
    async getLedger(organizationId: string, partyId: string) {
        const party = await this.findById(organizationId, partyId);

        const [invoices, payments] = await Promise.all([
            this.prisma.invoice.findMany({
                where: {
                    organizationId,
                    partyId,
                    isCancelled: false,
                    deletedAt: null,
                },
                orderBy: { invoiceDate: 'asc' },
                select: {
                    id: true,
                    invoiceNumber: true,
                    invoiceDate: true,
                    invoiceType: true,
                    totalAmount: true,
                    paidAmount: true,
                    balanceAmount: true,
                },
            }),
            this.prisma.payment.findMany({
                where: {
                    organizationId,
                    partyId,
                    deletedAt: null,
                },
                orderBy: { paymentDate: 'asc' },
                select: {
                    id: true,
                    paymentDate: true,
                    paymentType: true,
                    paymentMode: true,
                    amount: true,
                    referenceNumber: true,
                },
            }),
        ]);

        const transactions = [
            ...invoices.map((inv) => ({
                type: 'invoice',
                date: inv.invoiceDate,
                ...inv,
            })),
            ...payments.map((pay) => ({
                type: 'payment',
                date: pay.paymentDate,
                ...pay,
            })),
        ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        return {
            party,
            openingBalance: party.openingBalance,
            currentBalance: party.currentBalance,
            transactions,
            summary: {
                totalInvoices: invoices.length,
                totalPayments: payments.length,
                totalInvoiced: invoices.reduce((sum, inv) => sum + Number(inv.totalAmount), 0),
                totalPaid: payments.reduce((sum, pay) => sum + Number(pay.amount), 0),
                totalOutstanding: invoices.reduce((sum, inv) => sum + Number(inv.balanceAmount), 0),
            },
        };
    }

    /**
     * ✅ UPDATED: Update party with ledger name sync
     */
    async update(organizationId: string, id: string, dto: UpdatePartyDto) {
        const party = await this.findById(organizationId, id);

        // ✅ Validate GSTIN if being updated
        if (dto.gstin) {
            const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
            if (!gstinRegex.test(dto.gstin)) {
                throw new BadRequestException('Invalid GSTIN format');
            }

            // Check for duplicate (excluding current party)
            const existingGstin = await this.prisma.party.findFirst({
                where: {
                    organizationId,
                    gstin: dto.gstin,
                    id: { not: id },
                    deletedAt: null,
                },
            });

            if (existingGstin) {
                throw new BadRequestException(
                    `GSTIN "${dto.gstin}" is already used by: ${existingGstin.businessName}`
                );
            }
        }

        // ✅ Validate PAN if being updated
        if (dto.pan) {
            const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
            if (!panRegex.test(dto.pan)) {
                throw new BadRequestException('Invalid PAN format');
            }
        }

        // ✅ Validate phone if being updated
        if (dto.phone && dto.phone !== party.phone) {
            const existingPhone = await this.prisma.party.findFirst({
                where: {
                    organizationId,
                    phone: dto.phone,
                    id: { not: id },
                    deletedAt: null,
                },
            });

            if (existingPhone) {
                throw new BadRequestException(
                    `Phone "${dto.phone}" is already used by: ${existingPhone.businessName}`
                );
            }
        }

        return this.prisma.$transaction(async (tx) => {
            // ✅ Update party
            const updatedParty = await tx.party.update({
                where: { id },
                data: {
                    businessName: dto.businessName,
                    contactPerson: dto.contactPerson,
                    phone: dto.phone,
                    email: dto.email,
                    whatsappNumber: dto.whatsappNumber,
                    addressLine1: dto.addressLine1,
                    addressLine2: dto.addressLine2,
                    city: dto.city,
                    state: dto.state,
                    pincode: dto.pincode,
                    gstin: dto.gstin,
                    pan: dto.pan,
                    creditLimit: dto.creditLimit,
                    creditDays: dto.creditDays,
                    notes: dto.notes,
                    tags: dto.tags,
                    isActive: dto.isActive,
                },
            });

            // ✅ Sync ledger name if business name changed
            if (dto.businessName && party.ledger?.id) {
                await tx.ledger.update({
                    where: { id: party.ledger.id },
                    data: {
                        ledgerName: dto.businessName,
                        description: `Party ledger for ${dto.businessName}`,
                    },
                });

                console.log(
                    `✅ Ledger name synced: "${party.businessName}" → "${dto.businessName}"`
                );
            }

            return updatedParty;
        });
    }

    /**
     * ✅ UPDATED: Delete party with comprehensive validation
     */
    async remove(organizationId: string, id: string) {
        const party = await this.findById(organizationId, id);

        // ✅ Check if party has any transactions
        const [invoiceCount, paymentCount] = await Promise.all([
            this.prisma.invoice.count({
                where: { partyId: id },
            }),
            this.prisma.payment.count({
                where: { partyId: id },
            }),
        ]);

        if (invoiceCount > 0 || paymentCount > 0) {
            throw new BadRequestException(
                `Cannot delete party with ${invoiceCount} invoice(s) and ${paymentCount} payment(s). ` +
                `Deactivate the party instead to prevent new transactions.`
            );
        }

        // ✅ Check if ledger has voucher entries
        if (party.ledger?.id) {
            const entryCount = await this.prisma.voucherEntry.count({
                where: { ledgerId: party.ledger.id },
            });

            if (entryCount > 0) {
                throw new BadRequestException(
                    `Cannot delete party with ${entryCount} ledger entries. ` +
                    `Deactivate instead.`
                );
            }
        }

        return this.prisma.$transaction(async (tx) => {
            // ✅ Delete party ledger first
            if (party.ledger?.id) {
                await tx.ledger.update({
                    where: { id: party.ledger.id },
                    data: {
                        deletedAt: new Date(),
                        isActive: false,
                    },
                });
            }

            // ✅ Delete party
            await tx.party.update({
                where: { id },
                data: {
                    deletedAt: new Date(),
                    isActive: false,
                },
            });

            return {
                success: true,
                message: `Party "${party.businessName}" and associated ledger deleted successfully`,
            };
        });
    }

    /**
     * ✅ NEW: Deactivate party (better than delete)
     */
    async deactivate(organizationId: string, id: string) {
        const party = await this.findById(organizationId, id);

        return this.prisma.$transaction(async (tx) => {
            // Deactivate party
            await tx.party.update({
                where: { id },
                data: { isActive: false },
            });

            // Deactivate ledger
            if (party.ledger?.id) {
                await tx.ledger.update({
                    where: { id: party.ledger.id },
                    data: { isActive: false },
                });
            }

            return {
                success: true,
                message: `Party "${party.businessName}" deactivated. No new transactions will be allowed.`,
            };
        });
    }

    /**
     * ✅ NEW: Get parties with outstanding balances
     */
    async getPartiesWithOutstanding(organizationId: string, partyType?: PartyType) {
        const where: Prisma.PartyWhereInput = {
            organizationId,
            isActive: true,
            deletedAt: null,
        };

        if (partyType) {
            where.partyType = partyType;
        }

        const parties = await this.prisma.party.findMany({
            where,
            include: {
                ledger: {
                    select: {
                        currentBalance: true,
                    },
                },
            },
        });

        // Filter parties with non-zero balance
        return parties
            .filter((party) => {
                const balance = Number(party.ledger?.currentBalance || 0);
                return balance !== 0;
            })
            .map((party) => ({
                id: party.id,
                partyCode: party.partyCode,
                businessName: party.businessName,
                partyType: party.partyType,
                phone: party.phone,
                currentBalance: party.ledger?.currentBalance || 0,
                creditLimit: party.creditLimit,
                creditDays: party.creditDays,
            }))
            .sort((a, b) => Math.abs(Number(b.currentBalance)) - Math.abs(Number(a.currentBalance)));
    }

    /**
     * ✅ NEW: Get ageing analysis for party
     */
    async getAgeingAnalysis(organizationId: string, partyId: string) {
        const party = await this.findById(organizationId, partyId);

        const outstandingInvoices = await this.prisma.invoice.findMany({
            where: {
                organizationId,
                partyId,
                balanceAmount: { gt: 0 },
                isCancelled: false,
                deletedAt: null,
            },
            select: {
                id: true,
                invoiceNumber: true,
                invoiceDate: true,
                invoiceType: true,
                totalAmount: true,
                balanceAmount: true,
                dueDate: true,
            },
            orderBy: {
                invoiceDate: 'asc',
            },
        });

        const today = new Date();
        const ageing = {
            current: 0, // 0-30 days
            thirtyDays: 0, // 31-60 days
            sixtyDays: 0, // 61-90 days
            ninetyDays: 0, // 91-120 days
            aboveOneTwenty: 0, // >120 days
        };

        const ageingDetails = outstandingInvoices.map((invoice) => {
            const dueDate = invoice.dueDate || invoice.invoiceDate;
            const daysPending = Math.floor(
                (today.getTime() - new Date(dueDate).getTime()) / (1000 * 60 * 60 * 24)
            );

            const balance = Number(invoice.balanceAmount);

            if (daysPending <= 30) {
                ageing.current += balance;
            } else if (daysPending <= 60) {
                ageing.thirtyDays += balance;
            } else if (daysPending <= 90) {
                ageing.sixtyDays += balance;
            } else if (daysPending <= 120) {
                ageing.ninetyDays += balance;
            } else {
                ageing.aboveOneTwenty += balance;
            }

            return {
                ...invoice,
                daysPending,
                ageingBucket: daysPending <= 30 ? '0-30' :
                    daysPending <= 60 ? '31-60' :
                        daysPending <= 90 ? '61-90' :
                            daysPending <= 120 ? '91-120' : '>120',
            };
        });

        return {
            party: {
                id: party.id,
                businessName: party.businessName,
                partyType: party.partyType,
            },
            totalOutstanding: party.currentBalance,
            ageing,
            invoices: ageingDetails,
        };
    }

    /**
     * ✅ NEW: Merge duplicate parties
     */
    async mergeDuplicates(
        organizationId: string,
        primaryPartyId: string,
        duplicatePartyId: string,
        userId: string,
    ) {
        const [primaryParty, duplicateParty] = await Promise.all([
            this.findById(organizationId, primaryPartyId),
            this.findById(organizationId, duplicatePartyId),
        ]);

        if (primaryParty.partyType !== duplicateParty.partyType) {
            throw new BadRequestException(
                'Cannot merge parties of different types'
            );
        }

        return this.prisma.$transaction(async (tx) => {
            // Move all invoices to primary party
            await tx.invoice.updateMany({
                where: { partyId: duplicatePartyId },
                data: { partyId: primaryPartyId },
            });

            // Move all payments to primary party
            await tx.payment.updateMany({
                where: { partyId: duplicatePartyId },
                data: { partyId: primaryPartyId },
            });

            // Delete duplicate party
            await tx.party.update({
                where: { id: duplicatePartyId },
                data: { deletedAt: new Date() },
            });

            // Delete duplicate ledger
            if (duplicateParty.ledger?.id) {
                await tx.ledger.update({
                    where: { id: duplicateParty.ledger.id },
                    data: { deletedAt: new Date() },
                });
            }

            return {
                success: true,
                message: `Merged "${duplicateParty.businessName}" into "${primaryParty.businessName}"`,
            };
        });
    }
}