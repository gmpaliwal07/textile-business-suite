import {
    Controller,
    Get,
    Post,
    Body,
    Query,
    UseGuards,
    BadRequestException,
    Param,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ProductBatchesService } from './product-batches.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Product Batches')
@Controller('products/batches')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ProductBatchesController {
    constructor(private batchesService: ProductBatchesService) { }

    /**
     * Get all batches for a specific product (FIFO order)
     */
    @Get()
    @ApiOperation({ summary: 'Get all batches for a product (FIFO order)' })
    async getBatchesForProduct(
        @CurrentUser() user: any,
        @Query('productId') productId: string,
    ) {
        if (!productId) {
            throw new BadRequestException('productId query parameter is required');
        }

        return this.batchesService.getBatchesForProduct(user.organizationId, productId);
    }

    /**
     * Get batch-wise stock report
     */
    @Get('report')
    @ApiOperation({ summary: 'Get batch-wise stock report' })
    async getBatchStockReport(
        @CurrentUser() user: any,
        @Query('productId') productId?: string,
    ) {
        return this.batchesService.getBatchStockReport(user.organizationId, productId);
    }

    /**
     * Create new batch manually
     */
    @Post()
    @ApiOperation({ summary: 'Create new batch manually' })
    async createBatch(
        @CurrentUser() user: any,
        @Body() dto: {
            productId: string;
            batchNumber: string;
            lotNumber?: string;
            purchaseInvoiceId?: string;
            purchaseDate: string;
            purchasePrice: number;
            quantity: number;
            godownLocation?: string;
            thaan?: string;
            designNumber?: string;
            color?: string;
            expiryDate?: string;
            notes?: string;
        },
    ) {
        return this.batchesService.create(user.organizationId, dto.productId, {
            batchNumber: dto.batchNumber,
            lotNumber: dto.lotNumber,
            purchaseInvoiceId: dto.purchaseInvoiceId,
            purchaseDate: new Date(dto.purchaseDate),
            purchasePrice: dto.purchasePrice,
            quantity: dto.quantity,
            godownLocation: dto.godownLocation,
            thaan: dto.thaan,
            designNumber: dto.designNumber,
            color: dto.color,
            expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : undefined,
            notes: dto.notes,
        });
    }
}