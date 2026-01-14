import { Injectable, BadRequestException } from '@nestjs/common';
import { prisma } from '@textile/database';
import { SyncRequestDto, BatchSyncDto } from './dto';

/**
 * Sync Service - Handles offline data synchronization
 * 
 * HOW IT WORKS:
 * 1. Mobile app creates data offline with temporary local IDs
 * 2. When online, sends batch sync request
 * 3. Server processes each request and returns server IDs
 * 4. Mobile app maps local IDs to server IDs
 * 5. Conflict resolution: Server wins (can be customized)
 */

@Injectable()
export class SyncService {
    constructor(private prisma: prisma.PrismaService) { }

    /**
     * Process batch sync requests
     */
    async batchSync(organizationId: string, dto: BatchSyncDto, userId: string) {
        const results = [];

        // Process each request in order
        for (const request of dto.requests) {
            try {
                const result = await this.processSyncRequest(organizationId, request, userId);
                results.push({
                    localId: request.localId,
                    success: true,
                    serverId: result.serverId,
                    data: result.data,
                });
            } catch (error) {
                results.push({
                    localId: request.localId,
                    success: false,
                    error: error,
                });
            }
        }

        return {
            success: true,
            results,
            synced: results.filter((r) => r.success).length,
            failed: results.filter((r) => !r.success).length,
        };
    }

    /**
     * Process single sync request
     */
    private async processSyncRequest(
        organizationId: string,
        request: SyncRequestDto,
        userId: string,
    ) {
        const { entityType, action, localId, data } = request;

        // Route to appropriate handler
        switch (entityType) {
            case 'invoice':
                return this.syncInvoice(organizationId, action, localId, data, userId);
            case 'payment':
                return this.syncPayment(organizationId, action, localId, data, userId);
            case 'party':
                return this.syncParty(organizationId, action, localId, data, userId);
            case 'product':
                return this.syncProduct(organizationId, action, localId, data, userId);
            default:
                throw new BadRequestException(`Unknown entity type: ${entityType}`);
        }
    }

    /**
     * Sync invoice
     */
    private async syncInvoice(
        organizationId: string,
        action: string,
        localId: string,
        data: any,
        userId: string,
    ) {
        if (action === 'create') {
            // Check if already synced (by localId or unique fields)
            const existing = await this.prisma.invoice.findFirst({
                where: {
                    organizationId,
                    invoiceNumber: data.invoiceNumber,
                },
            });

            if (existing) {
                return { serverId: existing.id, data: existing };
            }

            // Create new invoice
            const invoice = await this.prisma.invoice.create({
                data: {
                    ...data,
                    organizationId,
                    createdBy: userId,
                    syncStatus: 'synced',
                },
            });

            return { serverId: invoice.id, data: invoice };
        }

        if (action === 'update') {
            // Find by server ID (if available) or invoice number
            const invoice = await this.prisma.invoice.findFirst({
                where: {
                    organizationId,
                    OR: [{ id: localId }, { invoiceNumber: data.invoiceNumber }],
                },
            });

            if (!invoice) {
                throw new BadRequestException('Invoice not found for update');
            }

            const updated = await this.prisma.invoice.update({
                where: { id: invoice.id },
                data: {
                    ...data,
                    syncStatus: 'synced',
                },
            });

            return { serverId: updated.id, data: updated };
        }

        if (action === 'delete') {
            const invoice = await this.prisma.invoice.findFirst({
                where: {
                    organizationId,
                    id: localId,
                },
            });

            if (invoice) {
                await this.prisma.invoice.update({
                    where: { id: invoice.id },
                    data: { deletedAt: new Date() },
                });
            }

            return { serverId: localId, data: null };
        }

        throw new BadRequestException(`Unknown action: ${action}`);
    }

    /**
     * Sync payment
     */
    private async syncPayment(
        organizationId: string,
        action: string,
        localId: string,
        data: any,
        userId: string,
    ) {
        if (action === 'create') {
            const payment = await this.prisma.payment.create({
                data: {
                    ...data,
                    organizationId,
                    createdBy: userId,
                    syncStatus: 'synced',
                },
            });

            // Update invoice if linked
            if (data.invoiceId) {
                await this.updateInvoiceBalance(data.invoiceId, data.amount);
            }

            return { serverId: payment.id, data: payment };
        }

        // Similar logic for update and delete
        throw new BadRequestException('Update and delete for payments not implemented yet');
    }

    /**
     * Sync party
     */
    private async syncParty(
        organizationId: string,
        action: string,
        localId: string,
        data: any,
        userId: string,
    ) {
        if (action === 'create') {
            // Check if already exists by phone
            const existing = await this.prisma.party.findFirst({
                where: {
                    organizationId,
                    phone: data.phone,
                },
            });

            if (existing) {
                return { serverId: existing.id, data: existing };
            }

            const party = await this.prisma.party.create({
                data: {
                    ...data,
                    organizationId,
                    createdBy: userId,
                    syncStatus: 'synced',
                },
            });

            return { serverId: party.id, data: party };
        }

        // Similar logic for update and delete
        throw new BadRequestException('Update and delete for parties not implemented yet');
    }

    /**
     * Sync product
     */
    private async syncProduct(
        organizationId: string,
        action: string,
        localId: string,
        data: any,
        userId: string,
    ) {
        if (action === 'create') {
            const product = await this.prisma.product.create({
                data: {
                    ...data,
                    organizationId,
                    createdBy: userId,
                    syncStatus: 'synced',
                },
            });

            return { serverId: product.id, data: product };
        }

        throw new BadRequestException('Update and delete for products not implemented yet');
    }

    /**
     * Helper: Update invoice balance after payment
     */
    private async updateInvoiceBalance(invoiceId: string, paymentAmount: number) {
        const invoice = await this.prisma.invoice.findUnique({
            where: { id: invoiceId },
        });

        if (invoice) {
            await this.prisma.invoice.update({
                where: { id: invoiceId },
                data: {
                    paidAmount: {
                        increment: paymentAmount,
                    },
                    balanceAmount: {
                        decrement: paymentAmount,
                    },
                },
            });
        }
    }

    /**
     * Get pending sync items for a user
     */
    async getPendingSync(organizationId: string) {
        const pending = await this.prisma.syncLog.findMany({
            where: {
                organizationId,
                syncStatus: 'pending',
            },
            orderBy: {
                createdAt: 'asc',
            },
            take: 100,
        });

        return pending;
    }

    /**
     * Mark sync as complete
     */
    async markSyncComplete(organizationId: string, syncLogId: string) {
        return this.prisma.syncLog.update({
            where: { id: syncLogId },
            data: {
                syncStatus: 'synced',
                syncedAt: new Date(),
            },
        });
    }
}