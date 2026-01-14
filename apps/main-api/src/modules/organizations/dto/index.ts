import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, Length, IsBoolean, IsDateString, IsEnum } from 'class-validator';

export class CreateOrganizationDto {
    @ApiProperty({ example: 'Raj Textiles' })
    @IsString()
    businessName!: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    legalName?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @Length(15, 15)
    gstin?: string;

    @ApiProperty({ example: '9876543210' })
    @IsString()
    phone!: string;

    @ApiProperty({ example: 'Ring Road, Surat' })
    @IsString()
    addressLine1!: string;

    @ApiProperty({ example: 'Surat' })
    @IsString()
    city!: string;

    @ApiProperty({ example: 'Gujarat' })
    @IsString()
    state!: string;

    @ApiProperty({ example: '395001' })
    @IsString()
    @Length(6, 6)
    pincode!: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsEmail()
    email?: string;
}

export class UpdateOrganizationDto {
    @IsOptional()
    @IsString()
    businessName?: string;

    @IsOptional()
    @IsString()
    legalName?: string;

    @IsOptional()
    @IsString()
    gstin?: string;

    @IsOptional()
    @IsString()
    addressLine1?: string;

    @IsOptional()
    @IsString()
    city?: string;

    @IsOptional()
    @IsString()
    state?: string;

    @IsOptional()
    @IsString()
    logoUrl?: string;
}

export class SetupFinancialYearDto {
    @ApiProperty({ example: '2024-04-01' })
    @IsDateString()
    booksBeginningDate!: string;

    @ApiProperty({ example: 'trader', enum: ['trader', 'manufacturer', 'retailer'] })
    @IsEnum(['trader', 'manufacturer', 'retailer'])
    businessType!: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsBoolean()
    isMigrationMode?: boolean;
}

export class LockBooksDto {
    @ApiProperty({ example: '2024-03-31' })
    @IsDateString()
    lockDate!: string;
}