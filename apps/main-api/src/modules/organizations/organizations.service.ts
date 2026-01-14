import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { prisma } from '@textile/database';
import { CreateOrganizationDto, LockBooksDto, SetupFinancialYearDto, UpdateOrganizationDto } from './dto';
import { LedgerSetupService } from '../vouchers/services/ledger-setup.service';
import { STATE_CODES } from '@textile/shared/constants';

@Injectable()
export class OrganizationsService {
    constructor(
        private prisma: prisma.PrismaService,
        private ledgerSetupService: LedgerSetupService
    ) { }

    /**
     * ✅ FIXED: Create organization with proper FY setup and opening balance voucher preparation
     */
    async create(dto: CreateOrganizationDto) {
        // Validate GSTIN
        if (dto.gstin) {
            this.validateGSTIN(dto.gstin, dto.state);

            const existing = await this.prisma.organization.findUnique({
                where: { gstin: dto.gstin }
            });

            if (existing) {
                throw new BadRequestException('This GSTIN is already registered');
            }
        }

        const trialEndsAt = new Date();
        trialEndsAt.setDate(trialEndsAt.getDate() + 90);

        // Auto-calculate current FY
        const today = new Date();
        const currentYear = today.getFullYear();
        const currentMonth = today.getMonth() + 1;

        let fyStart: Date;
        let fyEnd: Date;

        if (currentMonth >= 4) {
            fyStart = new Date(currentYear, 3, 1); // Apr 1, current year
            fyEnd = new Date(currentYear + 1, 2, 31); // Mar 31, next year
        } else {
            fyStart = new Date(currentYear - 1, 3, 1); // Apr 1, last year
            fyEnd = new Date(currentYear, 2, 31); // Mar 31, current year
        }

        const organization = await this.prisma.organization.create({
            data: {
                ...dto,
                subscriptionStatus: 'trial',
                trialEndsAt,
                booksBeginningDate: fyStart,
                currentFYStart: fyStart,
                currentFYEnd: fyEnd,
                businessType: 'trader',
                isMigrationMode: false, // Default to new business
                isChartSetup: false,
                isOpeningBalanceEntered: false, // Will be true only after voucher is finalized
            },
        });

        // ✅ Setup default chart of accounts
        try {
            await this.ledgerSetupService.setupDefaultLedgers(organization.id);

            await this.prisma.organization.update({
                where: { id: organization.id },
                data: { isChartSetup: true }
            });

            console.log(`✅ Chart of accounts setup completed for ${organization.businessName}`);
        } catch (error) {
            console.error('❌ Failed to setup ledgers:', error);
        }

        return organization;
    }

    /**
     * ✅ IMPROVED: Setup/modify financial year with validation
     */
    async setupFinancialYear(id: string, dto: SetupFinancialYearDto) {
        const org = await this.findById(id);

        // ✅ Check if transactions exist
        const transactionCount = await this.prisma.voucher.count({
            where: { organizationId: id, deletedAt: null }
        });

        if (transactionCount > 0 && dto.booksBeginningDate) {
            throw new BadRequestException(
                'Cannot change books beginning date after transactions exist. ' +
                'Create a new financial year instead.'
            );
        }

        const fyStart = new Date(dto.booksBeginningDate);
        const fyEnd = new Date(fyStart);
        fyEnd.setFullYear(fyEnd.getFullYear() + 1);
        fyEnd.setDate(fyEnd.getDate() - 1);

        return this.prisma.organization.update({
            where: { id },
            data: {
                booksBeginningDate: fyStart,
                currentFYStart: fyStart,
                currentFYEnd: fyEnd,
                businessType: dto.businessType,
                isMigrationMode: dto.isMigrationMode || false,
            },
        });
    }

    /**
     * ✅ COMPLETELY REWRITTEN: Opening balance status with voucher-based validation
     */
    async getOpeningBalanceStatus(id: string) {
        const org = await this.findById(id);

        if (!org.isMigrationMode) {
            return {
                required: false,
                isLocked: false,
                isTallied: true,
                message: 'Opening balance entry not required (new business)'
            };
        }

        // ✅ Find opening balance voucher
        const openingVoucher = await this.prisma.voucher.findFirst({
            where: {
                organizationId: id,
                voucherType: 'journal',
                referenceType: 'opening_balance',
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
        });

        if (!openingVoucher) {
            return {
                required: true,
                isLocked: false,
                isTallied: false,
                totalDebit: 0,
                totalCredit: 0,
                difference: 0,
                message: 'Opening balance voucher not created yet. Please create via journal entry.',
            };
        }

        const totalDebit = Number(openingVoucher.totalDebit);
        const totalCredit = Number(openingVoucher.totalCredit);
        const difference = Math.abs(totalDebit - totalCredit);
        const isTallied = difference < 0.01;

        // ✅ Check if locked (can't edit after other transactions exist)
        const otherTransactionCount = await this.prisma.voucher.count({
            where: {
                organizationId: id,
                id: { not: openingVoucher.id },
                deletedAt: null,
            },
        });

        const isLocked = otherTransactionCount > 0;

        await this.prisma.organization.update({
            where: { id },
            data: {
                openingBalanceDiff: difference,
                isOpeningBalanceEntered: isTallied,
            },
        });

        return {
            required: true,
            isLocked,
            isTallied,
            voucherId: openingVoucher.id,
            voucherNumber: openingVoucher.voucherNumber,
            voucherDate: openingVoucher.voucherDate,
            totalDebit: Math.round(totalDebit * 100) / 100,
            totalCredit: Math.round(totalCredit * 100) / 100,
            difference: Math.round(difference * 100) / 100,
            entries: openingVoucher.entries.map(e => ({
                ledgerName: e.ledger.ledgerName,
                ledgerType: e.ledger.ledgerType,
                debit: Math.round(Number(e.debitAmount) * 100) / 100,
                credit: Math.round(Number(e.creditAmount) * 100) / 100,
            })),
            message: isTallied
                ? isLocked
                    ? 'Opening balances tallied and locked. Cannot edit.'
                    : 'Opening balances tallied. You can now create transactions.'
                : `Opening balances do not tally. Difference: ₹${difference.toFixed(2)}. Please adjust.`,
        };
    }

    /**
     * ✅ IMPROVED: Books lock with enforcement check
     */
    async lockBooks(id: string, dto: LockBooksDto) {
        const org = await this.findById(id);

        const lockDate = new Date(dto.lockDate);
        if (lockDate > new Date()) {
            throw new BadRequestException('Cannot lock books for future dates');
        }

        if (org.booksLockedBefore && lockDate < org.booksLockedBefore) {
            throw new BadRequestException(
                `Cannot set lock date before current lock (${org.booksLockedBefore.toLocaleDateString()})`
            );
        }

        // ✅ Check if any vouchers exist after this date
        const vouchersAfterLock = await this.prisma.voucher.findFirst({
            where: {
                organizationId: id,
                voucherDate: { gt: lockDate },
                deletedAt: null,
            },
        });

        if (vouchersAfterLock) {
            console.warn(
                `⚠️ Locking books before ${lockDate.toLocaleDateString()}, ` +
                `but vouchers exist after this date. They can no longer be edited.`
            );
        }

        return this.prisma.organization.update({
            where: { id },
            data: {
                booksLockedBefore: lockDate,
            },
        });
    }

    /**
     * ✅ NEW: Check if date is locked (for use in voucher/invoice/payment services)
     */
    async isDateLocked(organizationId: string, date: Date): Promise<boolean> {
        const org = await this.findById(organizationId);

        if (!org.booksLockedBefore) {
            return false;
        }

        return date < org.booksLockedBefore;
    }

    /**
     * ✅ NEW: Validate transaction date is within current FY
     */
    async validateTransactionDate(organizationId: string, date: Date): Promise<void> {
        const org = await this.findById(organizationId);

        if (!org.currentFYStart || !org.currentFYEnd) {
            return; // No FY set up yet
        }

        if (date < org.currentFYStart || date > org.currentFYEnd) {
            throw new BadRequestException(
                `Transaction date must be within current FY: ` +
                `${org.currentFYStart.toLocaleDateString()} to ${org.currentFYEnd.toLocaleDateString()}`
            );
        }
    }

    /**
     * ✅ IMPROVED: Check subscription with enforcement
     */
    async checkSubscriptionStatus(id: string): Promise<{ isActive: boolean; message?: string }> {
        const org = await this.findById(id);

        if (org.subscriptionStatus === 'active') {
            return { isActive: true };
        }

        if (org.subscriptionStatus === 'trial') {
            if (org.trialEndsAt && org.trialEndsAt > new Date()) {
                const daysLeft = Math.ceil(
                    (org.trialEndsAt.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
                );
                return {
                    isActive: true,
                    message: daysLeft <= 7
                        ? `Trial expires in ${daysLeft} days. Please subscribe to continue.`
                        : undefined,
                };
            }
            await this.prisma.organization.update({
                where: { id },
                data: { subscriptionStatus: 'expired' },
            });
            return {
                isActive: false,
                message: 'Trial period expired. Please subscribe to continue.',
            };
        }

        return {
            isActive: false,
            message: 'Subscription expired. Please renew to continue.',
        };
    }

    /**
     * ✅ IMPROVED: Setup status with detailed checks
     */
    async getSetupStatus(id: string) {
        const org = await this.findById(id);

        const [ledgerCount, partyCount, productCount, voucherCount] = await Promise.all([
            this.prisma.ledger.count({ where: { organizationId: id, deletedAt: null } }),
            this.prisma.party.count({ where: { organizationId: id, deletedAt: null } }),
            this.prisma.product.count({ where: { organizationId: id, deletedAt: null } }),
            this.prisma.voucher.count({ where: { organizationId: id, deletedAt: null } }),
        ]);

        const openingBalanceStatus = await this.getOpeningBalanceStatus(id);
        const subscriptionStatus = await this.checkSubscriptionStatus(id);

        const isReadyForTransactions =
            org.isChartSetup &&
            (org.isOpeningBalanceEntered || !org.isMigrationMode) &&
            subscriptionStatus.isActive;

        return {
            organizationCreated: true,
            chartOfAccountsSetup: org.isChartSetup && ledgerCount > 0,
            openingBalanceEntered: org.isOpeningBalanceEntered,
            openingBalanceStatus,
            hasParties: partyCount > 0,
            hasProducts: productCount > 0,
            hasTransactions: voucherCount > 0,
            subscriptionStatus,
            isReadyForTransactions,
            businessType: org.businessType,
            isMigrationMode: org.isMigrationMode,
            currentFY: {
                start: org.currentFYStart,
                end: org.currentFYEnd,
            },
            booksLockedBefore: org.booksLockedBefore,
        };
    }

    async findById(id: string) {
        const organization = await this.prisma.organization.findUnique({
            where: { id, isActive: true, deletedAt: null },
        });

        if (!organization) {
            throw new NotFoundException('Organization not found');
        }

        return organization;
    }

    async update(id: string, dto: UpdateOrganizationDto) {
        await this.findById(id);

        if (dto.gstin && dto.state) {
            this.validateGSTIN(dto.gstin, dto.state);
        }

        return this.prisma.organization.update({
            where: { id },
            data: dto,
        });
    }

    private validateGSTIN(gstin: string, state: string): void {
        if (!gstin || gstin.length !== 15) {
            throw new BadRequestException('GSTIN must be 15 characters');
        }

        const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
        if (!gstinRegex.test(gstin)) {
            throw new BadRequestException('Invalid GSTIN format. Expected: 24AAAAA0000A1Z5');
        }

        const gstinStateCode = gstin.substring(0, 2);
        const expectedStateCode = STATE_CODES[state];

        if (!expectedStateCode) {
            throw new BadRequestException(`Unknown state: ${state}`);
        }

        if (gstinStateCode !== expectedStateCode) {
            throw new BadRequestException(
                `GSTIN state code (${gstinStateCode}) does not match organization state (${state}, expected ${expectedStateCode})`
            );
        }
    }

    async incrementInvoiceCounter(id: string): Promise<number> {
        const organization = await this.prisma.organization.update({
            where: { id },
            data: {
                invoiceCounter: {
                    increment: 1,
                },
            },
            select: {
                invoiceCounter: true,
            },
        });

        return organization.invoiceCounter;
    }

    async deactivate(id: string) {
        const org = await this.findById(id);

        const [outstandingInvoices, outstandingParties, stock] = await Promise.all([
            this.prisma.invoice.count({
                where: {
                    organizationId: id,
                    balanceAmount: { gt: 0 },
                    deletedAt: null,
                },
            }),
            this.prisma.party.count({
                where: {
                    organizationId: id,
                    ledger: {
                        currentBalance: { not: 0 },
                    },
                    deletedAt: null,
                },
            }),
            this.prisma.product.aggregate({
                where: {
                    organizationId: id,
                    deletedAt: null,
                },
                _sum: {
                    currentStock: true,
                },
            }),
        ]);

        if (outstandingInvoices > 0 || outstandingParties > 0 || (stock._sum.currentStock && Number(stock._sum.currentStock) > 0)) {
            throw new BadRequestException(
                `Cannot deactivate organization. Found:\n` +
                `- ${outstandingInvoices} pending invoice(s)\n` +
                `- ${outstandingParties} party/parties with outstanding\n` +
                `- ${Number(stock._sum.currentStock || 0).toFixed(2)} units of stock\n\n` +
                `Please clear all balances first.`
            );
        }

        return this.prisma.organization.update({
            where: { id },
            data: { isActive: false },
        });
    }

    async verifyLedgerSetup(id: string) {
        return this.ledgerSetupService.verifySetup(id);
    }
}