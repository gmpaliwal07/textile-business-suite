import { IsString, IsOptional, IsEmail, IsEnum, IsNumber, Min, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { PartyType } from '@textile/database';
export class CreatePartyDto {
    @ApiProperty({ enum: PartyType })
    @IsEnum(PartyType)
    partyType!: PartyType;

    @ApiProperty({ example: 'ABC Traders' })
    @IsString()
    businessName!: string;

    @ApiProperty({ example: '9876543210', required: false })
    @IsOptional()
    @IsString()
    whatsappNumber?: string;

    @ApiProperty({ example: '9876543210' })
    @IsString()
    phone!: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsEmail()
    email?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    gstin?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    addressLine1?: string;

    @ApiProperty({ required: false, default: '' })
    @IsOptional()
    @IsString()
    addressLine2?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    city?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    state?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    pincode?: string;

    @ApiProperty({ required: false, default: 0 })
    @IsOptional()
    @IsNumber()
    @Min(0)
    openingBalance?: number;

    @ApiProperty({ required: false, default: 0 })
    @IsOptional()
    @IsNumber()
    @Min(0)
    creditLimit?: number;

    @ApiProperty({ required: false, default: 0 })
    @IsOptional()
    @IsNumber()
    @Min(0)
    creditDays?: number;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    notes?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    pan?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    tags?: string[];

    @ApiProperty({ required: false })
    @IsOptional()
    contactPerson?: string;

}

export class UpdatePartyDto {
    @IsOptional()
    @IsString()
    businessName?: string;

    @IsOptional()
    @IsString()
    phone?: string;

    @IsOptional()
    @IsEmail()
    email?: string;

    @IsOptional()
    @IsString()
    addressLine1?: string;

    @IsOptional()
    @IsString()
    city?: string;

    @IsOptional()
    @IsNumber()
    creditLimit?: number;

    @IsOptional()
    @IsNumber()
    creditDays?: number;

    @IsOptional()
    @IsString()
    notes?: string;

    @IsOptional()
    @IsString()
    pan?: string;

    @IsOptional()
    @IsString()
    gstin?: string;


    @IsOptional()
    @IsString()
    contactPerson?: string;


    @IsOptional()
    @IsString()
    whatsappNumber?: string;

    @IsOptional()
    @IsString()
    addressLine2?: string;

    @IsOptional()
    @IsString()
    state?: string;

    @IsOptional()
    @IsNumber()
    pincode?: string;

    @IsOptional()
    @IsBoolean()
    isActive?: boolean;

    @IsOptional()
    @IsString()
    tags?: string[];
}

export class PartyFiltersDto {
    @ApiProperty({ required: false })
    @IsOptional()
    @IsEnum(PartyType)
    partyType?: PartyType;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    search?: string;

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

    @ApiProperty({ required: false, default: 'createdAt' })
    @IsOptional()
    @IsString()
    sortBy?: string;

    @ApiProperty({ required: false, default: 'DESC', enum: ['ASC', 'DESC'] })
    @IsOptional()
    @IsEnum(['ASC', 'DESC'])
    sortOrder?: 'ASC' | 'DESC';
}