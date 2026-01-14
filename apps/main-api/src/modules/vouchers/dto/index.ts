import {
    IsString,
    IsEnum,
    IsOptional,
    IsDateString,
    IsArray,
    ValidateNested,
    IsNumber,
    Min,
    IsBoolean,
    IsInt,
    MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { VoucherType } from '@textile/database';
import { PartialType } from '@nestjs/mapped-types';

export class VoucherEntryDto {
    @IsString()
    ledgerId!: string;

    @IsString()
    ledgerName!: string;

    @IsNumber()
    @Type(() => Number)
    @Min(0)
    debitAmount!: number;

    @IsNumber()
    @Type(() => Number)
    @Min(0)
    creditAmount!: number;

    @IsOptional()
    @IsNumber()
    @Type(() => Number)
    gstRate?: number;

    @IsOptional()
    @IsNumber()
    @Type(() => Number)
    cgstAmount?: number;

    @IsOptional()
    @IsNumber()
    @Type(() => Number)
    sgstAmount?: number;

    @IsOptional()
    @IsNumber()
    @Type(() => Number)
    igstAmount?: number;

    @IsOptional()
    @IsNumber()
    @Type(() => Number)
    cessAmount?: number;

    @IsOptional()
    @IsString()
    narration?: string;
}

export class CreateVoucherDto {
    @IsEnum(VoucherType)
    voucherType!: VoucherType;

    @IsDateString()
    voucherDate!: string;

    @IsString()
    narration!: string;

    @IsOptional()
    @IsString()
    referenceType?: string;

    @IsOptional()
    @IsString()
    referenceId?: string;

    @IsOptional()
    @IsString()
    referenceNumber?: string;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => VoucherEntryDto)
    entries!: VoucherEntryDto[];
}



export class UpdteVoucherDto extends PartialType(CreateVoucherDto) {

    @IsOptional()
    @IsString()
    isPosted?: boolean;
}

export class VoucherFiltersDto {
    @IsOptional()
    @IsInt()
    @Type(() => Number)
    @Min(1)
    page?: number = 1;

    @IsOptional()
    @IsInt()
    @Type(() => Number)
    @Min(1)
    limit?: number = 50;

    @IsOptional()
    @IsString()
    search?: string;

    @IsOptional()
    @IsEnum(VoucherType)
    voucherType?: VoucherType;

    @IsOptional()
    @IsDateString()
    startDate?: string;

    @IsOptional()
    @IsDateString()
    endDate?: string;

    @IsOptional()
    @IsString()
    referenceType?: string;

    @IsOptional()
    @IsString()
    referenceId?: string;

    @IsOptional()
    @IsBoolean()
    @Type(() => Boolean)
    isPosted?: boolean;

    @IsOptional()
    @IsBoolean()
    @Type(() => Boolean)
    isCancelled?: boolean;

    @IsOptional()
    @IsString()
    sortBy?: string = 'voucherDate';

    @IsOptional()
    @IsEnum(['ASC', 'DESC'])
    sortOrder?: 'ASC' | 'DESC' = 'DESC';
}

export class CancelVoucherDto {
    @IsString()
    @MinLength(5, { message: 'Cancellation reason must be at least 5 characters' })
    reason!: string;
}

