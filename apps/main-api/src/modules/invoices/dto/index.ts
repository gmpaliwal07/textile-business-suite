import {
    IsString,
    IsUUID,
    IsEnum,
    IsArray,
    IsNumber,
    IsOptional,
    IsBoolean,
    IsDateString,
    ValidateNested,
    Min,
    Max,
    ArrayMinSize,
    Matches,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { InvoiceType } from '@textile/database';
import { ReturnReason } from '@textile/shared';

export class CreateInvoiceItemDto {
    @ApiProperty({ example: 'uuid-here', required: false })
    @IsOptional()
    @IsUUID()
    productId?: string;

    @ApiProperty({ example: 'Cotton Saree' })
    @IsString()
    productName!: string;

    @ApiProperty({ example: 'PROD001', required: false })
    @IsOptional()
    @IsString()
    productCode?: string;

    @ApiProperty({ example: '52081200' })
    @IsString()
    hsnCode!: string;

    @ApiProperty({ example: 10 })
    @IsNumber()
    @Min(0.001)
    quantity!: number;

    @ApiProperty({ example: 'PCS' })
    @IsString()
    unit!: string;

    @ApiProperty({ example: 500 })
    @IsNumber()
    @Min(0)
    rate!: number;

    @ApiProperty({ example: 5, required: false, default: 0 })
    @IsOptional()
    @IsNumber()
    @Min(0)
    @Max(100)
    discountPercentage?: number;

    @ApiProperty({ example: 5 })
    @IsNumber()
    @Min(0)
    @Max(28)
    gstRate!: number;



    @ApiProperty({ example: 'THAAN-001' })
    @IsOptional()
    @IsString()
    thaan?: string;

    @ApiProperty({ example: 'Design-001' })
    @IsOptional()
    @IsString()
    designNumber?: string;

    @ApiProperty({ example: 'Blue' })
    @IsOptional()
    @IsString()
    color?: string;

    @ApiProperty({ example: 'LOT-001' })
    @IsOptional()
    @IsString()
    lotNumber?: string;
}

export class CreateInvoiceDto {
    @ApiProperty({ enum: InvoiceType })
    @IsEnum(InvoiceType)
    invoiceType!: string;

    @ApiProperty({ example: '2024-01-15', required: false })
    @IsOptional()
    @IsDateString()
    invoiceDate?: string;

    @ApiProperty({ example: '2024-02-15', required: false })
    @IsOptional()
    @IsDateString()
    dueDate?: string;

    @IsOptional()
    @IsString()
    deliveryAddressLine1?: string;

    @IsOptional()
    @IsString()
    deliveryAddressLine2?: string;

    @IsOptional()
    @IsString()
    deliveryCity?: string;

    @IsOptional()
    @IsString()
    deliveryState?: string;

    @IsOptional()
    @IsString()
    deliveryPincode?: string;

    @ApiProperty({ example: 'uuid-here' })
    @IsUUID()
    partyId!: string;

    @ApiProperty({ type: [CreateInvoiceItemDto] })
    @IsArray()
    @ArrayMinSize(1)
    @ValidateNested({ each: true })
    @Type(() => CreateInvoiceItemDto)
    items!: CreateInvoiceItemDto[];

    @ApiProperty({ example: 5, required: false, default: 0 })
    @IsOptional()
    @IsNumber()
    @Min(0)
    @Max(100)
    discountPercentage?: number;

    @ApiProperty({ example: 0, required: false })
    @IsOptional()
    @IsNumber()
    @Min(0)
    discountAmount?: number;

    @ApiProperty({ example: false, required: false, default: false })
    @IsOptional()
    @IsBoolean()
    reverseCharge?: boolean;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    notes?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    termsAndConditions?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    godownLocation?: string;


}

// ============================================
// UPDATE INVOICE DTO
// ============================================

export class UpdateInvoiceDto {
    @IsOptional()
    @IsDateString()
    invoiceDate?: string;

    @IsOptional()
    @IsDateString()
    dueDate?: string;

    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CreateInvoiceItemDto)
    items?: CreateInvoiceItemDto[];

    @IsOptional()
    @IsNumber()
    @Min(0)
    @Max(100)
    discountPercentage?: number;

    @IsOptional()
    @IsString()
    notes?: string;

    @IsOptional()
    @IsString()
    termsAndConditions?: string;
}

// ============================================
// INVOICE FILTERS DTO
// ============================================

export class InvoiceFiltersDto {
    @ApiProperty({ required: false, enum: InvoiceType })
    @IsOptional()
    @IsEnum(InvoiceType)
    invoiceType?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsUUID()
    partyId?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsDateString()
    startDate?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsDateString()
    endDate?: string;

    @ApiProperty({ required: false, enum: ['paid', 'unpaid', 'partial'] })
    @IsOptional()
    @IsEnum(['paid', 'unpaid', 'partial'])
    status?: string;

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

    @ApiProperty({ required: false, default: 'invoiceDate' })
    @IsOptional()
    @IsString()
    sortBy?: string;

    @ApiProperty({ required: false, default: 'DESC', enum: ['ASC', 'DESC'] })
    @IsOptional()
    @IsEnum(['ASC', 'DESC'])
    sortOrder?: 'ASC' | 'DESC';
}



export class CancelInvoiceDto {
    @ApiProperty({ example: 'Customer cancelled order' })
    @IsString()
    reason!: string;
}


export enum TransportMode {
    ROAD = '1',
    RAIL = '2',
    AIR = '3',
    SHIP = '4',
}

export class TransportDetailsDto {
    @ApiProperty({ enum: TransportMode, required: false, example: '1' })
    @IsOptional()
    @IsEnum(TransportMode)
    transportMode?: TransportMode;

    @ApiProperty({ description: 'Distance in KM (0 = auto-calculate)', example: 0, required: false })
    @IsOptional()
    @IsNumber()
    distance?: number;

    @ApiProperty({ description: 'Vehicle number, e.g. KA01AB1234', required: false })
    @IsOptional()
    @IsString()
    vehicleNumber?: string;

    @ApiProperty({ description: 'Transporter GSTIN (15 digits)', required: false })
    @IsOptional()
    @IsString()
    transporterId?: string;

    @ApiProperty({ description: 'LR/RR Number', required: false })
    @IsOptional()
    @IsString()
    transporterDocNumber?: string;

    @ApiProperty({ description: 'DD/MM/YYYY format', example: '18/12/2025', required: false })
    @IsOptional()
    @Matches(/^\d{2}\/\d{2}\/\d{4}$/)
    transporterDocDate?: string;
}

export class GenerateEwayBillDto {
    @ApiProperty({ description: 'Invoice ID to generate E-Way Bill from' })
    @IsString()
    invoiceId!: string;

    @ApiProperty({ type: TransportDetailsDto, required: false })
    @IsOptional()
    transport?: TransportDetailsDto;
}

class EwbItemDto {
    @IsString()
    hsn!: string;

    @IsString()
    productName!: string;

    @IsNumber()
    quantity!: number;

    @IsString()
    unit!: string;

    @IsNumber()
    taxableAmount!: number;

    @IsOptional()
    @IsNumber()
    cgst?: number;

    @IsOptional()
    @IsNumber()
    sgst?: number;

    @IsOptional()
    @IsNumber()
    igst?: number;
}

export class GenerateEwbDto {
    // Document details
    @IsString()
    docType!: string;

    @IsString()
    docNo!: string;

    @IsString()
    docDate!: string;

    // Seller / From
    @IsString()
    fromGstin!: string;

    @IsString()
    fromTradeName!: string;

    @IsString()
    fromAddr1!: string;

    @IsString()
    fromPincode!: string;

    @IsString()
    fromStateCode!: string;

    // Buyer / To
    @IsString()
    toGstin!: string;

    @IsString()
    toTradeName!: string;

    @IsString()
    toAddr1!: string;

    @IsString()
    toPincode!: string;

    @IsString()
    toStateCode!: string;

    // Transport
    @IsString()
    transportMode!: string;

    @IsOptional()
    @IsString()
    vehicleNumber?: string;

    @IsOptional()
    @IsString()
    transporterId?: string;

    @IsNumber()
    distance!: number;

    @IsOptional()
    @IsString()
    transporterDocNumber?: string;

    @IsOptional()
    @IsString()
    transporterDocDate?: string;

    // Items
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => EwbItemDto)
    items!: EwbItemDto[];

    @IsOptional()
    user?: any;
}






export class CancelEwbDto {
    @IsString()
    ewayBillNo!: string;

    @IsString()
    cancellationReason!: string;
}



export class UpdateVehicleDto {
    @IsString()
    ewayBillNo!: string;

    @IsOptional()
    @IsString()
    vehicleNumber?: string;

    @IsOptional()
    @IsString()
    transporterId?: string;

    @IsOptional()
    @IsString()
    transporterDocNumber?: string;

    @IsOptional()
    @IsString()
    transporterDocDate?: string;
}


export class GetEwbDto {
    @IsString() ewayBillNo!: string;
}

export class ReturnItemDto {
    @ApiProperty({ example: 'uuid-of-original-invoice-item' })
    @IsUUID()
    originalItemId!: string;

    @ApiProperty({ example: 5, description: 'Quantity to return' })
    @IsNumber()
    @Min(0.001)
    returnQuantity!: number;

    @ApiProperty({
        example: 'Damaged fabric - torn',
        description: 'Reason for returning this item',
        required: false
    })
    @IsOptional()
    @IsString()
    itemReason?: string;
}

export class CreateCreditNoteDto {
    @ApiProperty({ example: 'uuid-of-original-sale-invoice' })
    @IsUUID()
    originalInvoiceId!: string;

    @ApiProperty({
        enum: ReturnReason,
        example: ReturnReason.DAMAGED
    })
    @IsEnum(ReturnReason)
    returnReason!: ReturnReason;

    @ApiProperty({
        example: 'Fabric had tears and stains',
        required: false
    })
    @IsOptional()
    @IsString()
    notes?: string;

    @ApiProperty({
        type: [ReturnItemDto],
        description: 'Items to return with quantities'
    })
    @IsArray()
    @ArrayMinSize(1)
    @ValidateNested({ each: true })
    @Type(() => ReturnItemDto)
    items!: ReturnItemDto[];

    @ApiProperty({
        example: false,
        description: 'Are goods physically returned to stock?',
        default: true,
        required: false
    })
    @IsOptional()
    restockItems?: boolean;
}


export class CreateDebitNoteDto {
    @ApiProperty({ example: 'uuid-of-original-purchase-invoice' })
    @IsUUID()
    originalInvoiceId!: string;

    @ApiProperty({
        enum: ReturnReason,
        example: ReturnReason.QUALITY_ISSUE
    })
    @IsEnum(ReturnReason)
    returnReason!: ReturnReason;

    @ApiProperty({
        example: 'Supplier sent wrong color',
        required: false
    })
    @IsOptional()
    @IsString()
    notes?: string;

    @ApiProperty({
        type: [ReturnItemDto],
        description: 'Items to return with quantities'
    })
    @IsArray()
    @ArrayMinSize(1)
    @ValidateNested({ each: true })
    @Type(() => ReturnItemDto)
    items!: ReturnItemDto[];

    @ApiProperty({
        example: true,
        description: 'Are goods physically returned to supplier?',
        default: true,
        required: false
    })
    @IsOptional()
    removeFromStock?: boolean;
}


