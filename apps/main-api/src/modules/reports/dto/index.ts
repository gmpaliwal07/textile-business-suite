import {
    IsString,
    IsOptional,
    IsDateString,
    IsEnum,
    IsUUID,
    IsNumber,
    Min,
    Max,
    IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class DateRangeDto {
    @ApiProperty({ example: '2024-01-01', description: 'Start date (YYYY-MM-DD)' })
    @IsDateString()
    startDate!: string;

    @ApiProperty({ example: '2024-12-31', description: 'End date (YYYY-MM-DD)' })
    @IsDateString()
    endDate!: string;
}



export class SalesReportDto extends DateRangeDto {
    @ApiProperty({ required: false, description: 'Filter by specific party' })
    @IsOptional()
    @IsUUID()
    partyId?: string;

    @ApiProperty({
        required: false,
        enum: ['day', 'week', 'month'],
        description: 'Group sales by period',
        example: 'day'
    })
    @IsOptional()
    @IsEnum(['day', 'week', 'month'])
    groupBy?: string;
}



export class OutstandingReportDto {
    @ApiProperty({
        required: false,
        description: 'As of date (defaults to today)',
        example: '2024-12-31'
    })
    @IsOptional()
    @IsDateString()
    asOfDate?: string;

    @ApiProperty({
        required: false,
        enum: ['customer', 'supplier'],
        description: 'Filter by party type'
    })
    @IsOptional()
    @IsEnum(['customer', 'supplier'])
    partyType?: string;

    @ApiProperty({
        required: false,
        description: 'Minimum outstanding amount to include',
        example: 1000
    })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    minAmount?: number;

    @ApiProperty({
        required: false,
        default: false,
        description: 'Show only overdue parties'
    })
    @IsOptional()
    @Type(() => Boolean)
    @IsBoolean()
    overdueOnly?: boolean;
}



export class GSTReportDto {
    @ApiProperty({
        example: 1,
        description: 'Month (1-12)',
        minimum: 1,
        maximum: 12
    })
    @IsNumber()
    @Min(1)
    @Max(12)
    @Type(() => Number)
    month!: number;

    @ApiProperty({
        example: 2024,
        description: 'Year',
        minimum: 2000
    })
    @IsNumber()
    @Min(2000)
    @Type(() => Number)
    year!: number;

    @ApiProperty({
        enum: ['GSTR1', 'GSTR3B'],
        description: 'GST return type'
    })
    @IsEnum(['GSTR1', 'GSTR3B'])
    reportType!: string;
}

export class RatewiseGSTDto extends DateRangeDto {
    @ApiProperty({
        required: false,
        enum: ['sale', 'purchase'],
        description: 'Filter by invoice type'
    })
    @IsOptional()
    @IsEnum(['sale', 'purchase'])
    invoiceType?: 'sale' | 'purchase';
}



export class ProfitLossReportDto extends DateRangeDto { }

export class BalanceSheetDto {
    @ApiProperty({
        example: '2024-12-31',
        description: 'Balance sheet as of date (defaults to today)'
    })
    @IsOptional()
    @IsDateString()
    asOfDate?: string;
}

export class TrialBalanceDto {
    @ApiProperty({
        example: '2024-12-31',
        description: 'Trial balance as of date (defaults to today)'
    })
    @IsOptional()
    @IsDateString()
    asOfDate?: string;
}



export class InventoryReportDto {
    @ApiProperty({
        required: false,
        description: 'Filter by product category',
        example: 'Cotton Fabric'
    })
    @IsOptional()
    @IsString()
    category?: string;

    @ApiProperty({
        required: false,
        default: false,
        description: 'Show only low stock products'
    })
    @IsOptional()
    @Type(() => Boolean)
    @IsBoolean()
    lowStockOnly?: boolean;
}


export class LedgerReportDto extends DateRangeDto {
    @ApiProperty({
        description: 'Ledger ID',
        example: 'uuid-here'
    })
    @IsUUID()
    ledgerId!: string;
}
