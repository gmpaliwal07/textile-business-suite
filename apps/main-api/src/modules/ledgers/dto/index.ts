import {
    IsString,
    IsEnum,
    IsOptional,
    IsNumber,
    IsDateString,
    IsBoolean,
    Min,
    IsInt,
} from 'class-validator';
import { LedgerType } from '@textile/database';
import { Type } from 'class-transformer';
import { PartialType } from '@nestjs/mapped-types';

export class CreateLedgerDto {
    @IsString()
    ledgerName!: string;

    @IsOptional()
    @IsString()
    ledgerCode?: string;

    @IsEnum(LedgerType)
    ledgerType!: LedgerType;

    @IsString()
    ledgerGroupId!: string;

    @IsOptional()
    @IsNumber()
    @Type(() => Number)
    @Min(0)
    openingBalance?: number;

    @IsOptional()
    @IsDateString()
    openingDate?: string;

    // For Party Ledgers
    @IsOptional()
    @IsString()
    partyId?: string;

    // For Bank Ledgers
    @IsOptional()
    @IsString()
    bankName?: string;

    @IsOptional()
    @IsString()
    accountNumber?: string;

    @IsOptional()
    @IsString()
    ifscCode?: string;

    @IsOptional()
    @IsString()
    branchName?: string;

    // For GST Ledgers
    @IsOptional()
    @IsString()
    taxType?: string; // CGST, SGST, IGST, CESS

    @IsOptional()
    @IsNumber()
    @Type(() => Number)
    taxRate?: number;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}


export class UpdateLedgerDto extends PartialType(CreateLedgerDto) { }


export class LedgerFiltersDto {
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
    @IsEnum(LedgerType)
    ledgerType?: LedgerType;

    @IsOptional()
    @IsString()
    ledgerGroupId?: string;

    @IsOptional()
    @IsBoolean()
    @Type(() => Boolean)
    isSystemLedger?: boolean;

    @IsOptional()
    @IsBoolean()
    @Type(() => Boolean)
    isActive?: boolean;

    @IsOptional()
    @IsString()
    sortBy?: string = 'ledgerName';

    @IsOptional()
    @IsEnum(['ASC', 'DESC'])
    sortOrder?: 'ASC' | 'DESC' = 'ASC';
}


export class LedgerStatementDto {
    @IsOptional()
    @IsDateString()
    startDate?: string;

    @IsOptional()
    @IsDateString()
    endDate?: string;
}