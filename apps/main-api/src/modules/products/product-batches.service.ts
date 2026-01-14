import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { prisma } from '@textile/database';

@Injectable()
export class ProductBatchesService {
    constructor(private prisma: prisma.PrismaService) { }

    /**
     * Create new batch
     */
    async create(
        organizationId: string,
        productId: string,
        batchData: {
            batchNumber: string;
            lotNumber?: string;
            purchaseInvoiceId?: string;
            purchaseDate: Date;
            purchasePrice: number;
            quantity: number;
            godownLocation?: string;
            thaan?: string;
            designNumber?: string;
            color?: string;
            expiryDate?: Date;
            notes?: string;
        },
    ) {
        // Check if batch already exists
        const existing = await this.prisma.productBatch.findFirst({
            where: {
                organizationId,
                productId,
                batchNumber: batchData.batchNumber,
                deletedAt: null,
            },
        });

        if (existing) {
            throw new BadRequestException('Batch number already exists for this product');
        }

        return this.prisma.productBatch.create({
            data: {
                organizationId,
                productId,
                batchNumber: batchData.batchNumber,
                lotNumber: batchData.lotNumber,
                purchaseInvoiceId: batchData.purchaseInvoiceId,
                purchaseDate: batchData.purchaseDate,
                purchasePrice: batchData.purchasePrice,
                openingStock: batchData.quantity,
                currentStock: batchData.quantity,
                godownLocation: batchData.godownLocation,
                thaan: batchData.thaan,
                designNumber: batchData.designNumber,
                color: batchData.color,
                expiryDate: batchData.expiryDate,
                notes: batchData.notes,
            },
            include: {
                product: {
                    select: {
                        productCode: true,
                        productName: true,
                        unit: true,
                    },
                },
            },
        });
    }

    /**
     * Get all batches for a product (FIFO order)
     */
    async getBatchesForProduct(organizationId: string, productId: string) {
        return this.prisma.productBatch.findMany({
            where: {
                organizationId,
                productId,
                currentStock: { gt: 0 },
                isActive: true,
                deletedAt: null,
            },
            include: {
                product: {
                    select: {
                        productCode: true,
                        productName: true,
                        unit: true,
                    },
                },
            },
            orderBy: {
                purchaseDate: 'asc', // FIFO: First In First Out
            },
        });
    }

    /**
     * Allocate stock from batches (FIFO)
     * Used internally by invoices service
     */
    async allocateStock(
        tx: any,
        organizationId: string,
        productId: string,
        quantityNeeded: number,
    ): Promise<Array<{ batchId: string; quantity: number; costPrice: number }>> {
        const batches = await tx.productBatch.findMany({
            where: {
                organizationId,
                productId,
                currentStock: { gt: 0 },
                isActive: true,
                deletedAt: null,
            },
            orderBy: {
                purchaseDate: 'asc', // FIFO
            },
        });

        if (batches.length === 0) {
            throw new BadRequestException('No batches available for this product');
        }

        const allocations: Array<{ batchId: string; quantity: number; costPrice: number }> = [];
        let remainingQty = quantityNeeded;

        for (const batch of batches) {
            if (remainingQty <= 0) break;

            const availableQty = Number(batch.currentStock);
            const allocateQty = Math.min(availableQty, remainingQty);

            // Update batch stock
            await tx.productBatch.update({
                where: { id: batch.id },
                data: {
                    currentStock: {
                        decrement: allocateQty,
                    },
                },
            });

            allocations.push({
                batchId: batch.id,
                quantity: allocateQty,
                costPrice: Number(batch.purchasePrice),
            });

            remainingQty -= allocateQty;
        }

        if (remainingQty > 0) {
            throw new BadRequestException(
                `Insufficient batch stock. Available: ${quantityNeeded - remainingQty}, Required: ${quantityNeeded}`,
            );
        }

        return allocations;
    }

    /**
     * Get batch-wise stock report
     */
    async getBatchStockReport(organizationId: string, productId?: string) {
        const where: any = {
            organizationId,
            currentStock: { gt: 0 },
            isActive: true,
            deletedAt: null,
        };

        if (productId) {
            where.productId = productId;
        }

        const batches = await this.prisma.productBatch.findMany({
            where,
            include: {
                product: {
                    select: {
                        productCode: true,
                        productName: true,
                        unit: true,
                        category: true,
                    },
                },
            },
            orderBy: [{ productId: 'asc' }, { purchaseDate: 'asc' }],
        });

        const totalStockValue = batches.reduce(
            (sum, batch) => sum + (Number(batch.currentStock) * Number(batch.purchasePrice)),
            0,
        );

        return {
            summary: {
                totalBatches: batches.length,
                totalProducts: new Set(batches.map(b => b.productId)).size,
                totalStockValue: Math.round(totalStockValue * 100) / 100,
            },
            batches: batches.map((batch) => ({
                batchId: batch.id,
                batchNumber: batch.batchNumber,
                lotNumber: batch.lotNumber,
                productCode: batch.product.productCode,
                productName: batch.product.productName,
                category: batch.product.category,
                purchaseDate: batch.purchaseDate,
                purchasePrice: Number(batch.purchasePrice),
                currentStock: Number(batch.currentStock),
                openingStock: Number(batch.openingStock),
                unit: batch.product.unit,
                stockValue: Math.round(Number(batch.currentStock) * Number(batch.purchasePrice) * 100) / 100,
                godown: batch.godownLocation,
                thaan: batch.thaan,
                designNumber: batch.designNumber,
                color: batch.color,
                expiryDate: batch.expiryDate,
                ageInDays: Math.floor(
                    (new Date().getTime() - new Date(batch.purchaseDate).getTime()) / (1000 * 60 * 60 * 24)
                ),
            })),
        };
    }
}