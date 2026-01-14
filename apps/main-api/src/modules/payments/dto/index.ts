import {
    IsDateString,
    IsEnum,
    IsNumber,
    IsOptional,
    IsString,
    IsUUID,
    Min,
    IsArray,
    ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { ApiProperty } from "@nestjs/swagger";
import { PaymentMode, PaymentType } from "@textile/database";

// ============================================
// PAYMENT ALLOCATION DTO (Bill-wise)
// ============================================

export class PaymentAllocationDto {
    @ApiProperty({
        example: 'invoice-uuid',
        description: 'Invoice ID to allocate payment against'
    })
    @IsUUID()
    invoiceId!: string;

    @ApiProperty({
        example: 5000,
        description: 'Amount to allocate to this invoice'
    })
    @IsNumber()
    @Min(0.01)
    amount!: number;
}

// ============================================
// ✅ NEW: BILL-WISE PAYMENT DTO (RECOMMENDED)
// ============================================

export class CreateBillwisePaymentDto {
    @ApiProperty({
        enum: PaymentType,
        example: 'received',
        description: 'Payment direction: received (from customer) or paid (to supplier)'
    })
    @IsEnum(PaymentType)
    paymentType!: string;

    @ApiProperty({
        enum: PaymentMode,
        example: 'bank',
        description: 'Payment method'
    })
    @IsEnum(PaymentMode)
    paymentMode!: PaymentMode;

    @ApiProperty({
        example: '2025-01-07',
        required: false,
        description: 'Payment date (defaults to today)'
    })
    @IsOptional()
    @IsDateString()
    paymentDate?: string;

    @ApiProperty({
        example: 'party-uuid',
        description: 'Party (customer/supplier) ID'
    })
    @IsUUID()
    partyId!: string;

    @ApiProperty({
        example: 20000,
        description: 'Total payment amount'
    })
    @IsNumber()
    @Min(0.01)
    amount!: number;

    @ApiProperty({
        type: [PaymentAllocationDto],
        description: 'Invoice-wise payment allocation. Empty array = advance/on-account payment.',
        required: false,
        example: [
            { invoiceId: 'inv-1-uuid', amount: 10000 },
            { invoiceId: 'inv-2-uuid', amount: 5000 },
            { invoiceId: 'inv-3-uuid', amount: 5000 }
        ]
    })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => PaymentAllocationDto)
    allocations?: PaymentAllocationDto[];

    // Bank/Cheque details
    @ApiProperty({
        example: 'HDFC Bank',
        required: false,
        description: 'Bank name (for bank/cheque/UPI payments)'
    })
    @IsOptional()
    @IsString()
    bankName?: string;

    @ApiProperty({
        example: '123456',
        required: false,
        description: 'Cheque number (for cheque payments)'
    })
    @IsOptional()
    @IsString()
    chequeNumber?: string;

    @ApiProperty({
        example: '2025-01-07',
        required: false,
        description: 'Cheque date'
    })
    @IsOptional()
    @IsDateString()
    chequeDate?: string;

    @ApiProperty({
        example: 'pending',
        enum: ['pending', 'cleared', 'bounced'],
        required: false,
        description: 'Cheque status'
    })
    @IsOptional()
    @IsEnum(['pending', 'cleared', 'bounced'])
    chequeStatus?: string;

    @ApiProperty({
        example: 'UPI123456789',
        required: false,
        description: 'UPI transaction ID'
    })
    @IsOptional()
    @IsString()
    upiTransactionId?: string;

    @ApiProperty({
        example: '1234',
        required: false,
        description: 'Last 4 digits of card'
    })
    @IsOptional()
    @IsString()
    cardLast4Digits?: string;

    @ApiProperty({
        example: 'TXN123456',
        required: false,
        description: 'Reference number (optional)'
    })
    @IsOptional()
    @IsString()
    referenceNumber?: string;

    @ApiProperty({
        example: 'Payment for multiple invoices',
        required: false,
        description: 'Additional notes'
    })
    @IsOptional()
    @IsString()
    notes?: string;
}

// ============================================
// OLD: SINGLE INVOICE PAYMENT DTO (DEPRECATED)
// ============================================

export class CreatePaymentDto {
    @ApiProperty({ enum: PaymentType })
    @IsEnum(PaymentType)
    paymentType!: string;

    @ApiProperty({ enum: PaymentMode })
    @IsEnum(PaymentMode)
    paymentMode!: PaymentMode;

    @ApiProperty({ example: '2025-01-07', required: false })
    @IsOptional()
    @IsDateString()
    paymentDate?: string;

    @ApiProperty({ example: 'party-uuid' })
    @IsUUID()
    partyId!: string;

    @ApiProperty({ example: 5000 })
    @IsNumber()
    @Min(0.01)
    amount!: number;

    @ApiProperty({
        example: 'invoice-uuid',
        required: false,
        deprecated: true,
        description: 'DEPRECATED: Use CreateBillwisePaymentDto.allocations instead'
    })
    @IsOptional()
    @IsUUID()
    invoiceId?: string;

    @ApiProperty({ example: 'TXN123456', required: false })
    @IsOptional()
    @IsString()
    referenceNumber?: string;

    @ApiProperty({ example: 'HDFC Bank', required: false })
    @IsOptional()
    @IsString()
    bankName?: string;

    @ApiProperty({ example: '123456', required: false })
    @IsOptional()
    @IsString()
    chequeNumber?: string;

    @ApiProperty({ example: '2025-01-07', required: false })
    @IsOptional()
    @IsDateString()
    chequeDate?: string;

    @ApiProperty({ example: 'pending', enum: ['pending', 'cleared', 'bounced'], required: false })
    @IsOptional()
    @IsEnum(['pending', 'cleared', 'bounced'])
    chequeStatus?: string;

    @ApiProperty({ example: 'UPI123456789', required: false })
    @IsOptional()
    @IsString()
    upiTransactionId?: string;

    @ApiProperty({ example: '1234', required: false })
    @IsOptional()
    @IsString()
    cardLast4Digits?: string;

    @ApiProperty({ example: 'Partial payment', required: false })
    @IsOptional()
    @IsString()
    notes?: string;
}

// ============================================
// UPDATE PAYMENT DTO
// ============================================

export class UpdatePaymentDto {
    @ApiProperty({ example: '2025-01-07', required: false })
    @IsOptional()
    @IsDateString()
    paymentDate?: string;

    @ApiProperty({ example: 'TXN123456', required: false })
    @IsOptional()
    @IsString()
    referenceNumber?: string;

    @ApiProperty({ example: 'cleared', enum: ['pending', 'cleared', 'bounced'], required: false })
    @IsOptional()
    @IsEnum(['pending', 'cleared', 'bounced'])
    chequeStatus?: string;

    @ApiProperty({ example: 'Updated notes', required: false })
    @IsOptional()
    @IsString()
    notes?: string;
}

// ============================================
// PAYMENT FILTERS DTO
// ============================================

export class PaymentFiltersDto {
    @ApiProperty({ required: false, enum: ['received', 'paid'] })
    @IsOptional()
    @IsEnum(['received', 'paid'])
    paymentType?: string;

    @ApiProperty({ required: false, enum: ['cash', 'bank', 'cheque', 'upi', 'card', 'credit'] })
    @IsOptional()
    @IsEnum(['cash', 'bank', 'cheque', 'upi', 'card', 'credit'])
    paymentMode?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsUUID()
    partyId?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsUUID()
    invoiceId?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsDateString()
    startDate?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsDateString()
    endDate?: string;

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
    limit?: number;

    @ApiProperty({ required: false, default: 'paymentDate' })
    @IsOptional()
    @IsString()
    sortBy?: string;

    @ApiProperty({ required: false, default: 'DESC' })
    @IsOptional()
    @IsEnum(['ASC', 'DESC'])
    sortOrder?: 'ASC' | 'DESC';
}

export class AdjustAdvancePaymentDto {
    @ApiProperty({
        example: 'payment-uuid',
        description: 'ID of the advance/on-account payment'
    })
    @IsUUID()
    paymentId!: string;

    @ApiProperty({
        example: 'invoice-uuid',
        description: 'Invoice ID to apply advance against'
    })
    @IsUUID()
    invoiceId!: string;

    @ApiProperty({
        example: 30000,
        description: 'Amount to adjust from advance'
    })
    @IsNumber()
    @Min(0.01)
    amount!: number;
}

export class HandleChequeBounceDto {
    @ApiProperty({
        example: 'Insufficient funds',
        description: 'Reason for cheque bounce'
    })
    @IsString()
    bounceReason!: string;

    @ApiProperty({
        example: 500,
        required: false,
        description: 'Bank charges for bounced cheque'
    })
    @IsOptional()
    @IsNumber()
    @Min(0)
    bounceCharges?: number;

    @ApiProperty({
        example: '2025-01-10',
        required: false,
        description: 'Date when cheque bounced'
    })
    @IsOptional()
    @IsDateString()
    bounceDate?: string;
}