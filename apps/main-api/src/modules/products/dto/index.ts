import {
    IsString,
    IsNumber,
    IsOptional,
    IsBoolean,
    IsArray,
    IsUrl,
    Min,
    Max,
    Length,
    IsUUID,
    IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class CreateProductDto {
    @ApiProperty({ example: 'PROD001' })
    @IsString()
    productCode!: string;

    @ApiProperty({ example: 'Cotton Saree - Red' })
    @IsString()
    productName!: string;

    @ApiProperty({ example: 'Premium quality cotton saree', required: false })
    @IsOptional()
    @IsString()
    description?: string;

    @ApiProperty({ example: 'Sarees', required: false })
    @IsOptional()
    @IsString()
    category?: string;

    @ApiProperty({ example: 'Cotton', required: false })
    @IsOptional()
    @IsString()
    subcategory?: string;

    @ApiProperty({ example: 'https://example.com/image.jpg', required: false })
    @IsOptional()
    @IsUrl()
    primaryImageUrl?: string;

    @ApiProperty({
        example: ['https://example.com/img1.jpg', 'https://example.com/img2.jpg'],
        required: false,
        type: [String]
    })
    @IsOptional()
    @IsArray()
    @IsUrl({}, { each: true })
    imageUrls?: string[];

    @ApiProperty({ example: 500 })
    @IsNumber()
    @Min(0)
    basePrice!: number;

    @ApiProperty({ example: 450, required: false })
    @IsOptional()
    @IsNumber()
    @Min(0)
    salePrice?: number;

    @ApiProperty({ example: 350, required: false })
    @IsOptional()
    @IsNumber()
    @Min(0)
    purchasePrice?: number;

    @ApiProperty({ example: '52081200' })
    @IsString()
    @Length(4, 8)
    hsnCode!: string;

    @ApiProperty({ example: 5 })
    @IsNumber()
    @Min(0)
    @Max(28)
    gstRate!: number;

    @ApiProperty({ example: 0, required: false, default: 0 })
    @IsOptional()
    @IsNumber()
    @Min(0)
    cessRate?: number;

    @ApiProperty({ example: 'PCS', default: 'PCS' })
    @IsString()
    unit!: string;

    @ApiProperty({ example: 100, required: false, default: 0 })
    @IsOptional()
    @IsNumber()
    @Min(0)
    currentStock?: number;

    @ApiProperty({ example: 10, required: false, default: 0 })
    @IsOptional()
    @IsNumber()
    @Min(0)
    minStockLevel?: number;

    @ApiProperty({ example: 'Cotton', required: false })
    @IsOptional()
    @IsString()
    fabricType?: string;

    @ApiProperty({ example: 'DS-2024-001', required: false })
    @IsOptional()
    @IsString()
    designNumber?: string;

    @ApiProperty({ example: 'Red', required: false })
    @IsOptional()
    @IsString()
    color?: string;

    @ApiProperty({ example: 'L', required: false })
    @IsOptional()
    @IsString()
    size?: string;

    @ApiProperty({ example: 0.5, required: false })
    @IsOptional()
    @IsNumber()
    @Min(0)
    weight?: number;

    @ApiProperty({ example: '1234567890', required: false })
    @IsOptional()
    @IsString()
    barcode?: string;
}



export class UpdateProductDto {
    @IsOptional()
    @IsString()
    productName?: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsString()
    category?: string;

    @IsOptional()
    @IsString()
    subcategory?: string;

    @IsOptional()
    @IsUrl()
    primaryImageUrl?: string;

    @IsOptional()
    @IsArray()
    @IsUrl({}, { each: true })
    imageUrls?: string[];

    @IsOptional()
    @IsNumber()
    @Min(0)
    basePrice?: number;

    @IsOptional()
    @IsNumber()
    @Min(0)
    salePrice?: number;

    @IsOptional()
    @IsNumber()
    @Min(0)
    purchasePrice?: number;

    @IsOptional()
    @IsNumber()
    @Min(0)
    @Max(28)
    gstRate?: number;

    @IsOptional()
    @IsNumber()
    @Min(0)
    currentStock?: number;

    @IsOptional()
    @IsNumber()
    @Min(0)
    minStockLevel?: number;

    @IsOptional()
    @IsString()
    fabricType?: string;

    @IsOptional()
    @IsString()
    designNumber?: string;

    @IsOptional()
    @IsString()
    color?: string;

    @IsOptional()
    @IsString()
    size?: string;

    @IsOptional()
    @IsNumber()
    @Min(0)
    weight?: number;

    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}


export class ProductFiltersDto {
    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    category?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    search?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsBoolean()
    @Type(() => Boolean)
    isActive?: boolean;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsBoolean()
    @Type(() => Boolean)
    lowStock?: boolean;

    @ApiProperty({ required: false, default: 1 })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(1)
    page?: number;

    @ApiProperty({ required: false, default: 20 })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(1)
    @Max(100)
    limit?: number;

    @ApiProperty({ required: false, default: 'createdAt' })
    @IsOptional()
    @IsString()
    sortBy?: string;

    @ApiProperty({ required: false, default: 'DESC' })
    @IsOptional()
    @IsString()
    sortOrder?: 'ASC' | 'DESC';
}


export class UpdateStockDto {
    @ApiProperty({ example: 10 })
    @IsNumber()
    quantity!: number;

    @ApiProperty({ example: 'adjustment', enum: ['adjustment', 'sale', 'purchase', 'return'] })
    @IsString()
    type!: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    notes?: string;
}



export class CreateBatchDto {
    @ApiProperty({
        example: 'uuid-here',
        description: 'Product ID'
    })
    @IsUUID()
    productId!: string;

    @ApiProperty({
        example: 'BATCH-2024-001',
        description: 'Unique batch number'
    })
    @IsString()
    @Length(1, 50)
    batchNumber!: string;

    @ApiProperty({
        example: 'LOT-A-123',
        description: 'Lot number (optional)',
        required: false
    })
    @IsOptional()
    @IsString()
    lotNumber?: string;

    @ApiProperty({
        example: 'uuid-here',
        description: 'Purchase invoice ID (optional)',
        required: false
    })
    @IsOptional()
    @IsUUID()
    purchaseInvoiceId?: string;

    @ApiProperty({
        example: '2024-01-15',
        description: 'Purchase date (YYYY-MM-DD)'
    })
    @IsDateString()
    purchaseDate!: string;

    @ApiProperty({
        example: 450.50,
        description: 'Purchase price per unit'
    })
    @IsNumber()
    @Min(0)
    @Type(() => Number)
    purchasePrice!: number;

    @ApiProperty({
        example: 100,
        description: 'Initial quantity'
    })
    @IsNumber()
    @Min(0.001)
    @Type(() => Number)
    quantity!: number;

    @ApiProperty({
        example: 'Main Warehouse',
        description: 'Godown/warehouse location (optional)',
        required: false
    })
    @IsOptional()
    @IsString()
    godownLocation?: string;

    @ApiProperty({
        example: 'T-001',
        description: 'Thaan/Roll number (textile specific)',
        required: false
    })
    @IsOptional()
    @IsString()
    thaan?: string;

    @ApiProperty({
        example: 'DS-2024-RED-01',
        description: 'Design number (optional)',
        required: false
    })
    @IsOptional()
    @IsString()
    designNumber?: string;

    @ApiProperty({
        example: 'Red',
        description: 'Color (optional)',
        required: false
    })
    @IsOptional()
    @IsString()
    color?: string;

    @ApiProperty({
        example: '2025-12-31',
        description: 'Expiry date (YYYY-MM-DD, optional)',
        required: false
    })
    @IsOptional()
    @IsDateString()
    expiryDate?: string;

    @ApiProperty({
        example: 'Premium quality batch from Supplier X',
        description: 'Additional notes (optional)',
        required: false
    })
    @IsOptional()
    @IsString()
    notes?: string;
}

// ============================================
// UPDATE BATCH DTO
// ============================================
export class UpdateBatchDto {
    @ApiProperty({
        description: 'Update godown location',
        required: false
    })
    @IsOptional()
    @IsString()
    godownLocation?: string;

    @ApiProperty({
        description: 'Update thaan number',
        required: false
    })
    @IsOptional()
    @IsString()
    thaan?: string;

    @ApiProperty({
        description: 'Update notes',
        required: false
    })
    @IsOptional()
    @IsString()
    notes?: string;

    @ApiProperty({
        description: 'Activate/deactivate batch',
        required: false
    })
    @IsOptional()
    @Type(() => Boolean)
    isActive?: boolean;
}

// ============================================
// BATCH FILTERS DTO
// ============================================
export class BatchFiltersDto {
    @ApiProperty({
        required: false,
        description: 'Filter by product ID'
    })
    @IsOptional()
    @IsUUID()
    productId?: string;

    @ApiProperty({
        required: false,
        description: 'Filter by godown location'
    })
    @IsOptional()
    @IsString()
    godownLocation?: string;

    @ApiProperty({
        required: false,
        description: 'Show only expired batches',
        default: false
    })
    @IsOptional()
    @Type(() => Boolean)
    expiredOnly?: boolean;

    @ApiProperty({
        required: false,
        description: 'Minimum age in days',
        example: 90
    })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    minAgeInDays?: number;

    @ApiProperty({
        required: false,
        default: 1
    })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(1)
    page?: number;

    @ApiProperty({
        required: false,
        default: 20
    })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(1)
    limit?: number;
}
