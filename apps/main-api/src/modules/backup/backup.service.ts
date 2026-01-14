import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { prisma } from '@textile/database';
import { StorageService } from '../../common/storage/storage.service';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

@Injectable()
export class BackupService {
    private isCloudMode: boolean;

    constructor(
        private configService: ConfigService,
        private prisma: prisma.PrismaService,
        private storage: StorageService,
    ) {
        this.isCloudMode = !!this.configService.get('SUPABASE_URL');
    }

    /**
     * Daily backup at 11 PM (Cloud plan only)
     */
    @Cron('0 23 * * *') // Every day at 11 PM
    async dailyBackup() {
        if (!this.isCloudMode) {
            console.log('⏭️  Local plan - skipping cloud backup');
            return;
        }

        try {
            const timestamp = new Date().toISOString().split('T')[0];
            const filename = `backup-${timestamp}.sql`;

            // Export database
            const { stdout } = await execAsync(
                `pg_dump "${this.configService.get('DATABASE_URL')}"`,
            );

            // Upload to Supabase Storage
            const buffer = Buffer.from(stdout, 'utf-8');
            await this.storage.uploadFile(
                'backups',
                filename,
                buffer,
                'application/sql',
            );

            console.log(`✅ Backup created: ${filename}`);

            // Delete backups older than 30 days
            await this.deleteOldBackups();
        } catch (error) {
            console.error('❌ Backup failed:', error);
        }
    }

    /**
     * Manual backup trigger
     */
    async createBackup(organizationId: string) {
        if (!this.isCloudMode) {
            // Local: Export to JSON
            return this.exportLocalBackup(organizationId);
        } else {
            // Cloud: Trigger backup
            await this.dailyBackup();
            return { success: true, message: 'Backup created' };
        }
    }

    /**
     * Local backup - Export to Excel/JSON
     */
    async exportLocalBackup(organizationId: string) {
        // ✅ FIX 1.8: Get all data including accounting tables
        const [
            parties,
            products,
            invoices,
            payments,
            vouchers,
            ledgers,
            ledgerGroups,
            expenses,
            productBatches,
            recurringExpenses,
        ] = await Promise.all([
            this.prisma.party.findMany({ where: { organizationId } }),
            this.prisma.product.findMany({ where: { organizationId } }),
            this.prisma.invoice.findMany({
                where: { organizationId },
                include: { items: true }
            }),
            this.prisma.payment.findMany({
                where: { organizationId },
                include: { allocations: true }
            }),

            this.prisma.voucher.findMany({
                where: { organizationId },
                include: { entries: true }
            }),
            this.prisma.ledger.findMany({
                where: { organizationId },
                include: { ledgerGroup: true }
            }),
            this.prisma.ledgerGroup.findMany({ where: { organizationId } }),
            this.prisma.expense.findMany({ where: { organizationId } }),
            this.prisma.productBatch.findMany({ where: { organizationId } }),
            this.prisma.recurringExpense.findMany({ where: { organizationId } }),
        ]);

        const backup = {
            version: '2.0.0',
            exportDate: new Date(),
            organizationId,
            data: {
                // Master data
                parties,
                products,
                productBatches,

                // Transactions
                invoices,
                payments,
                expenses,
                recurringExpenses,

                // Accounting
                vouchers,
                ledgers,
                ledgerGroups,
            },
            integrity: {
                totalRecords: parties.length + products.length + invoices.length +
                    payments.length + vouchers.length + ledgers.length +
                    expenses.length + productBatches.length,
                timestamp: new Date().toISOString(),
                organizationName: '', // Will be filled by controller
            }
        };

        return {
            success: true,
            backup,
            downloadUrl: '/api/v1/backup/download', // Generate download
        };
    }

    /**
     * Delete old backups (30 days retention)
     */
    private async deleteOldBackups() {
        // Implementation to delete old files from storage
    }
}