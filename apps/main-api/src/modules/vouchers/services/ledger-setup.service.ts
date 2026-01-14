import { Injectable } from '@nestjs/common';
import { prisma } from '@textile/database';
import { GroupType, LedgerType, AffectsType } from '@textile/database';

@Injectable()
export class LedgerSetupService {
    constructor(private prisma: prisma.PrismaService) { }

    /**
     * ✅ UPDATED: Setup default ledger groups and system ledgers for new organization
     */
    async setupDefaultLedgers(organizationId: string) {
        console.log(`🔧 Setting up ledgers for organization: ${organizationId}`);

        // ============================================
        // STEP 1: CREATE PRIMARY LEDGER GROUPS (LEVEL 1)
        // ============================================

        // 1. Capital Account
        const capitalGroup = await this.createGroup(
            organizationId,
            'Capital Account',
            'capital_account',
            'balance_sheet',
            null,
            1,
            true,
        );

        // 2. Current Assets
        const currentAssetsGroup = await this.createGroup(
            organizationId,
            'Current Assets',
            'current_assets',
            'balance_sheet',
            null,
            1,
            true,
        );

        // 3. Current Liabilities
        const currentLiabilitiesGroup = await this.createGroup(
            organizationId,
            'Current Liabilities',
            'current_liabilities',
            'balance_sheet',
            null,
            1,
            true,
        );

        // 4. Fixed Assets
        const fixedAssetsGroup = await this.createGroup(
            organizationId,
            'Fixed Assets',
            'fixed_assets',
            'balance_sheet',
            null,
            1,
            true,
        );

        // 5. Loans (Liability)
        const loansLiabilityGroup = await this.createGroup(
            organizationId,
            'Loans (Liability)',
            'loans_liability',
            'balance_sheet',
            null,
            1,
            true,
        );

        // 6. Investments
        const investmentsGroup = await this.createGroup(
            organizationId,
            'Investments',
            'investments',
            'balance_sheet',
            null,
            1,
            true,
        );

        // 7. Sales Accounts
        const salesGroup = await this.createGroup(
            organizationId,
            'Sales Accounts',
            'sales_accounts',
            'profit_loss',
            null,
            1,
            true,
        );

        // 8. Purchase Accounts
        const purchaseGroup = await this.createGroup(
            organizationId,
            'Purchase Accounts',
            'purchase_accounts',
            'profit_loss',
            null,
            1,
            true,
        );

        // 9. Direct Expenses
        const directExpensesGroup = await this.createGroup(
            organizationId,
            'Direct Expenses',
            'direct_expenses',
            'profit_loss',
            null,
            1,
            true,
        );

        // 10. Indirect Expenses
        const indirectExpensesGroup = await this.createGroup(
            organizationId,
            'Indirect Expenses',
            'indirect_expenses',
            'profit_loss',
            null,
            1,
            true,
        );

        // 11. Direct Incomes
        const directIncomesGroup = await this.createGroup(
            organizationId,
            'Direct Incomes',
            'direct_incomes',
            'profit_loss',
            null,
            1,
            true,
        );

        // 12. Indirect Incomes
        const indirectIncomesGroup = await this.createGroup(
            organizationId,
            'Indirect Incomes',
            'indirect_incomes',
            'profit_loss',
            null,
            1,
            true,
        );

        console.log('✅ Primary ledger groups (Level 1) created');

        // ============================================
        // STEP 2: CREATE SUB-GROUPS (LEVEL 2)
        // ============================================

        // Under Current Assets
        const debtorsGroup = await this.createGroup(
            organizationId,
            'Sundry Debtors',
            'current_assets',
            'balance_sheet',
            currentAssetsGroup.id,
            2,
            true,
        );

        const cashBankGroup = await this.createGroup(
            organizationId,
            'Cash & Bank',
            'current_assets',
            'balance_sheet',
            currentAssetsGroup.id,
            2,
            true,
        );

        const dutiesTaxesAssetGroup = await this.createGroup(
            organizationId,
            'Duties & Taxes (Asset)',
            'current_assets',
            'balance_sheet',
            currentAssetsGroup.id,
            2,
            true,
        );

        // Under Current Liabilities
        const creditorsGroup = await this.createGroup(
            organizationId,
            'Sundry Creditors',
            'current_liabilities',
            'balance_sheet',
            currentLiabilitiesGroup.id,
            2,
            true,
        );

        const dutiesTaxesLiabilityGroup = await this.createGroup(
            organizationId,
            'Duties & Taxes (Liability)',
            'current_liabilities',
            'balance_sheet',
            currentLiabilitiesGroup.id,
            2,
            true,
        );

        console.log('✅ Sub-groups (Level 2) created');

        // ============================================
        // STEP 3: CREATE GST SUB-GROUPS (LEVEL 3)
        // ============================================

        // Output GST (Liability)
        const gstOutputGroup = await this.createGroup(
            organizationId,
            'Output GST',
            'current_liabilities',
            'balance_sheet',
            dutiesTaxesLiabilityGroup.id,
            3,
            true,
        );

        // Input GST (Asset)
        const gstInputGroup = await this.createGroup(
            organizationId,
            'Input GST',
            'current_assets',
            'balance_sheet',
            dutiesTaxesAssetGroup.id,
            3,
            true,
        );

        console.log('✅ GST sub-groups (Level 3) created');

        // ============================================
        // STEP 4: CREATE SYSTEM LEDGERS
        // ============================================

        const systemLedgers = [
            // ========== CASH & BANK ==========
            {
                name: 'Cash-in-Hand',
                type: 'cash' as LedgerType,
                groupId: cashBankGroup.id,
                description: 'Cash transactions',
            },
            {
                name: 'Bank Account - Main',
                type: 'bank' as LedgerType,
                groupId: cashBankGroup.id,
                description: 'Primary bank account',
            },

            // ========== CAPITAL ==========
            {
                name: 'Capital Account',
                type: 'capital' as LedgerType,
                groupId: capitalGroup.id,
                description: 'Owner\'s capital',
            },

            // ========== SALES ==========
            {
                name: 'Sales - Textile',
                type: 'sales' as LedgerType,
                groupId: salesGroup.id,
                description: 'Textile product sales',
            },
            {
                name: 'Sales Return',
                type: 'sales_return' as LedgerType,
                groupId: salesGroup.id,
                description: 'Returns from customers',
            },

            // ========== PURCHASE ==========
            {
                name: 'Purchase - Raw Material',
                type: 'purchase' as LedgerType,
                groupId: purchaseGroup.id,
                description: 'Raw material purchases',
            },
            {
                name: 'Purchase Return',
                type: 'purchase_return' as LedgerType,
                groupId: purchaseGroup.id,
                description: 'Returns to suppliers',
            },

            // ========== GST OUTPUT (LIABILITY) ==========
            {
                name: 'CGST Output',
                type: 'gst_output' as LedgerType,
                groupId: gstOutputGroup.id,
                taxType: 'CGST',
                description: 'Central GST on sales',
            },
            {
                name: 'SGST Output',
                type: 'gst_output' as LedgerType,
                groupId: gstOutputGroup.id,
                taxType: 'SGST',
                description: 'State GST on sales',
            },
            {
                name: 'IGST Output',
                type: 'gst_output' as LedgerType,
                groupId: gstOutputGroup.id,
                taxType: 'IGST',
                description: 'Integrated GST on interstate sales',
            },
            {
                name: 'Cess Output',
                type: 'gst_output' as LedgerType,
                groupId: gstOutputGroup.id,
                taxType: 'CESS',
                description: 'Cess on luxury items',
            },

            // ========== GST INPUT (ASSET) ==========
            {
                name: 'CGST Input',
                type: 'gst_input' as LedgerType,
                groupId: gstInputGroup.id,
                taxType: 'CGST',
                description: 'Central GST on purchases',
            },
            {
                name: 'SGST Input',
                type: 'gst_input' as LedgerType,
                groupId: gstInputGroup.id,
                taxType: 'SGST',
                description: 'State GST on purchases',
            },
            {
                name: 'IGST Input',
                type: 'gst_input' as LedgerType,
                groupId: gstInputGroup.id,
                taxType: 'IGST',
                description: 'Integrated GST on interstate purchases',
            },
            {
                name: 'Cess Input',
                type: 'gst_input' as LedgerType,
                groupId: gstInputGroup.id,
                taxType: 'CESS',
                description: 'Cess on purchases',
            },

            // ========== TCS/TDS ==========
            {
                name: 'TCS Payable',
                type: 'liability' as LedgerType,
                groupId: dutiesTaxesLiabilityGroup.id,
                description: 'Tax Collected at Source - Payable to govt',
            },
            {
                name: 'TDS Receivable',
                type: 'asset' as LedgerType,
                groupId: dutiesTaxesAssetGroup.id,
                description: 'Tax Deducted at Source - Receivable from govt',
            },

            // ========== DIRECT EXPENSES ==========
            {
                name: 'Freight Inward',
                type: 'expense' as LedgerType,
                groupId: directExpensesGroup.id,
                description: 'Transport cost on purchases',
            },
            {
                name: 'Labour Charges',
                type: 'expense' as LedgerType,
                groupId: directExpensesGroup.id,
                description: 'Direct labor cost',
            },
            {
                name: 'Packing Material',
                type: 'expense' as LedgerType,
                groupId: directExpensesGroup.id,
                description: 'Packaging expenses',
            },
            {
                name: 'Godown Charges',
                type: 'expense' as LedgerType,
                groupId: directExpensesGroup.id,
                description: 'Warehouse/storage charges',
            },
            {
                name: 'Carriage Outward',
                type: 'expense' as LedgerType,
                groupId: directExpensesGroup.id,
                description: 'Transport cost on sales',
            },

            // ========== INDIRECT EXPENSES ==========
            {
                name: 'Rent',
                type: 'expense' as LedgerType,
                groupId: indirectExpensesGroup.id,
                description: 'Office/shop rent',
            },
            {
                name: 'Electricity',
                type: 'expense' as LedgerType,
                groupId: indirectExpensesGroup.id,
                description: 'Power expenses',
            },
            {
                name: 'Salary',
                type: 'expense' as LedgerType,
                groupId: indirectExpensesGroup.id,
                description: 'Employee salaries',
            },
            {
                name: 'Office Expenses',
                type: 'expense' as LedgerType,
                groupId: indirectExpensesGroup.id,
                description: 'Stationery, printing, etc',
            },
            {
                name: 'Telephone & Internet',
                type: 'expense' as LedgerType,
                groupId: indirectExpensesGroup.id,
                description: 'Communication expenses',
            },
            {
                name: 'Repairs & Maintenance',
                type: 'expense' as LedgerType,
                groupId: indirectExpensesGroup.id,
                description: 'Equipment maintenance',
            },
            {
                name: 'Insurance',
                type: 'expense' as LedgerType,
                groupId: indirectExpensesGroup.id,
                description: 'Insurance premiums',
            },
            {
                name: 'Bank Charges',
                type: 'expense' as LedgerType,
                groupId: indirectExpensesGroup.id,
                description: 'Banking fees',
            },
            {
                name: 'Legal & Professional Fees',
                type: 'expense' as LedgerType,
                groupId: indirectExpensesGroup.id,
                description: 'CA, lawyer fees',
            },
            {
                name: 'Advertisement',
                type: 'expense' as LedgerType,
                groupId: indirectExpensesGroup.id,
                description: 'Marketing expenses',
            },
            {
                name: 'Broker Commission',
                type: 'expense' as LedgerType,
                groupId: indirectExpensesGroup.id,
                description: 'Commission to brokers',
            },
            {
                name: 'Travelling Expenses',
                type: 'expense' as LedgerType,
                groupId: indirectExpensesGroup.id,
                description: 'Business travel',
            },
            {
                name: 'Depreciation',
                type: 'expense' as LedgerType,
                groupId: indirectExpensesGroup.id,
                description: 'Asset depreciation',
            },
            {
                name: 'Miscellaneous Expenses',
                type: 'expense' as LedgerType,
                groupId: indirectExpensesGroup.id,
                description: 'Other expenses',
            },

            // ========== DIRECT INCOMES ==========
            {
                name: 'Interest Received',
                type: 'income' as LedgerType,
                groupId: directIncomesGroup.id,
                description: 'Interest on deposits',
            },
            {
                name: 'Discount Received',
                type: 'income' as LedgerType,
                groupId: directIncomesGroup.id,
                description: 'Discounts from suppliers',
            },

            // ========== INDIRECT INCOMES ==========
            {
                name: 'Commission Received',
                type: 'income' as LedgerType,
                groupId: indirectIncomesGroup.id,
                description: 'Commission income',
            },
            {
                name: 'Scrap Sale',
                type: 'income' as LedgerType,
                groupId: indirectIncomesGroup.id,
                description: 'Sale of waste material',
            },
            {
                name: 'Miscellaneous Income',
                type: 'income' as LedgerType,
                groupId: indirectIncomesGroup.id,
                description: 'Other incomes',
            },

            // ========== ADJUSTMENT LEDGERS ==========
            {
                name: 'Round Off',
                type: 'round_off' as LedgerType,
                groupId: indirectExpensesGroup.id,
                description: 'Invoice rounding adjustments',
            },

            // ========== STOCK ADJUSTMENT ==========
            {
                name: 'Stock Adjustment - Gain',
                type: 'income' as LedgerType,
                groupId: directIncomesGroup.id,
                description: 'Physical stock gain',
            },
            {
                name: 'Stock Adjustment - Loss',
                type: 'expense' as LedgerType,
                groupId: directExpensesGroup.id,
                description: 'Physical stock loss/damage',
            },
            {
                name: 'Closing Stock',
                type: 'asset' as LedgerType,
                groupId: currentAssetsGroup.id,
                description: 'Year-end stock valuation',
            },

            // ========== FIXED ASSETS ==========
            {
                name: 'Machinery',
                type: 'asset' as LedgerType,
                groupId: fixedAssetsGroup.id,
                description: 'Manufacturing machinery',
            },
            {
                name: 'Furniture & Fixtures',
                type: 'asset' as LedgerType,
                groupId: fixedAssetsGroup.id,
                description: 'Office furniture',
            },
            {
                name: 'Computers & Software',
                type: 'asset' as LedgerType,
                groupId: fixedAssetsGroup.id,
                description: 'IT equipment',
            },
            {
                name: 'Vehicles',
                type: 'asset' as LedgerType,
                groupId: fixedAssetsGroup.id,
                description: 'Company vehicles',
            },

            // ========== LOANS ==========
            {
                name: 'Bank Loan - Working Capital',
                type: 'liability' as LedgerType,
                groupId: loansLiabilityGroup.id,
                description: 'Working capital loan from bank',
            },
        ];

        // Create all system ledgers
        for (const ledgerData of systemLedgers) {
            await this.prisma.ledger.create({
                data: {
                    organizationId,
                    ledgerName: ledgerData.name,
                    ledgerType: ledgerData.type,
                    ledgerGroupId: ledgerData.groupId,
                    isSystemLedger: true,
                    openingBalance: 0,
                    openingDate: new Date(),
                    currentBalance: 0,
                    taxType: ledgerData.taxType || null,
                    description: ledgerData.description || null,
                },
            });
        }

        console.log('✅ System ledgers created');

        // ============================================
        // STEP 5: SUMMARY
        // ============================================

        const summary = {
            success: true,
            message: 'Default ledgers setup completed successfully',
            stats: {
                primaryGroups: 12,
                subGroups: 5,
                gstGroups: 2,
                systemLedgers: systemLedgers.length,
                totalGroups: 19,
            },
            groups: {
                capitalGroup,
                currentAssetsGroup,
                currentLiabilitiesGroup,
                fixedAssetsGroup,
                loansLiabilityGroup,
                investmentsGroup,
                debtorsGroup,
                creditorsGroup,
                cashBankGroup,
                dutiesTaxesAssetGroup,
                dutiesTaxesLiabilityGroup,
                gstOutputGroup,
                gstInputGroup,
                salesGroup,
                purchaseGroup,
                directExpensesGroup,
                indirectExpensesGroup,
                directIncomesGroup,
                indirectIncomesGroup,
            },
        };

        console.log(`✅ Setup complete: ${summary.stats.totalGroups} groups, ${summary.stats.systemLedgers} ledgers`);

        return summary;
    }

    /**
     * ✅ UPDATED: Helper to create ledger group with isSystemLedger flag
     */
    private async createGroup(
        organizationId: string,
        groupName: string,
        groupType: GroupType,
        affects: AffectsType,
        parentGroupId: string | null,
        level: number,
        isSystemGroup: boolean = true,
    ) {
        return this.prisma.ledgerGroup.create({
            data: {
                organizationId,
                groupName,
                groupType,
                affects,
                parentGroupId,
                level,
                isSystemLedger: isSystemGroup,
            },
        });
    }

    /**
     * Get system ledger by name (NO CHANGES)
     */
    async getSystemLedger(organizationId: string, ledgerName: string) {
        return this.prisma.ledger.findFirst({
            where: {
                organizationId,
                ledgerName,
                isSystemLedger: true,
                deletedAt: null,
            },
        });
    }

    /**
     * Get ledger group by name (NO CHANGES)
     */
    async getLedgerGroup(organizationId: string, groupName: string) {
        return this.prisma.ledgerGroup.findFirst({
            where: {
                organizationId,
                groupName,
                deletedAt: null,
            },
        });
    }

    /**
     * ✅ NEW: Verify if default setup is complete
     */
    async verifySetup(organizationId: string): Promise<{
        isComplete: boolean;
        missing: string[];
    }> {
        const requiredGroups = [
            'Capital Account',
            'Current Assets',
            'Current Liabilities',
            'Sundry Debtors',
            'Sundry Creditors',
            'Sales Accounts',
            'Purchase Accounts',
        ];

        const requiredLedgers = [
            'Cash-in-Hand',
            'Capital Account',
            'CGST Output',
            'SGST Output',
            'IGST Output',
            'CGST Input',
            'SGST Input',
            'IGST Input',
        ];

        const missing: string[] = [];

        // Check groups
        for (const groupName of requiredGroups) {
            const group = await this.getLedgerGroup(organizationId, groupName);
            if (!group) {
                missing.push(`Group: ${groupName}`);
            }
        }

        // Check ledgers
        for (const ledgerName of requiredLedgers) {
            const ledger = await this.getSystemLedger(organizationId, ledgerName);
            if (!ledger) {
                missing.push(`Ledger: ${ledgerName}`);
            }
        }

        return {
            isComplete: missing.length === 0,
            missing,
        };
    }
}