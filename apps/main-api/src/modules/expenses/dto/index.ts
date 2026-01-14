import { PartialType } from "@nestjs/mapped-types";
import { ApiProperty } from "@nestjs/swagger";
import { ExpenseCategory, PaymentMode, ExpenseFrequency } from "@textile/database";
import { Type } from "class-transformer";
import { IsBoolean, IsDateString, IsEnum, IsNumber, IsOptional, IsString, Max, Min } from "class-validator";
export class CreateExpenseDto {
    @IsEnum(ExpenseCategory)
    expenseCategory!: ExpenseCategory;

    @IsString()
    ledgerId!: string;

    @IsNumber()
    @Min(0.01)
    amount!: number;

    @IsDateString()
    expenseDate!: string;

    @IsEnum(PaymentMode)
    paymentMode!: PaymentMode;

    @IsOptional()
    @IsString()
    paidFrom?: string; // Cash / Bank ledger ID

    @IsOptional()
    @IsString()
    billNumber?: string;

    @IsOptional()
    @IsString()
    vendorName?: string;

    @IsOptional()
    @IsString()
    vendorId?: string; // Party ID (used to fetch vendor ledger)

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsString()
    attachmentUrl?: string;

    @IsOptional()
    @IsNumber()
    @Min(0)
    @Max(30)
    tdsRate?: number;

    @IsOptional()
    @IsBoolean()
    paidImmediately?: boolean; // defaults to true in service
}

export class UpdateExpenseDto {
    @IsOptional()
    @IsDateString()
    expenseDate?: string;

    @IsOptional()
    @IsNumber()
    @Min(0.01)
    amount?: number;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsString()
    billNumber?: string;

    @IsOptional()
    @IsString()
    vendorName?: string;

    @IsOptional()
    @IsString()
    attachmentUrl?: string;

    @IsOptional()
    @IsNumber()
    @Min(0)
    @Max(30)
    tdsRate?: number;
}

export class ExpenseFiltersDto {
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(1)
    page?: number;

    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(1)
    @Max(100)
    limit?: number;

    @IsOptional()
    @IsDateString()
    startDate?: string;

    @IsOptional()
    @IsDateString()
    endDate?: string;

    @IsOptional()
    @IsEnum(ExpenseCategory)
    expenseCategory?: ExpenseCategory;

    @IsOptional()
    @IsString()
    vendorId?: string;

    @IsOptional()
    @IsString()
    search?: string;

    @IsOptional()
    @IsString()
    sortBy?: string;

    @IsOptional()
    @IsEnum(['ASC', 'DESC'])
    sortOrder?: 'ASC' | 'DESC';
}




export class CreateRecurringExpenseDto {
    @IsEnum(ExpenseCategory)
    expenseCategory!: ExpenseCategory;

    @IsString()
    ledgerId!: string;

    @IsNumber()
    @Min(0.01)
    amount!: number;

    @IsEnum(ExpenseFrequency)
    frequency!: ExpenseFrequency;

    @IsDateString()
    startDate!: string;

    @IsOptional()
    @IsDateString()
    endDate?: string;

    @IsEnum(PaymentMode)
    paymentMode!: PaymentMode;

    @IsOptional()
    @IsString()
    paidFrom?: string;

    @IsOptional()
    @IsString()
    vendorId?: string; // 🔥 REQUIRED for vendor-linked recurring expenses

    @IsOptional()
    @IsString()
    vendorName?: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsNumber()
    @Min(0)
    @Max(30)
    tdsRate?: number;

    @IsOptional()
    @IsBoolean()
    paidImmediately?: boolean; // defaults true when generating expense

    @IsOptional()
    @IsBoolean()
    autoGenerate?: boolean;
}
export class UpdateRecurringExpenseDto extends PartialType(CreateRecurringExpenseDto) {
    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}