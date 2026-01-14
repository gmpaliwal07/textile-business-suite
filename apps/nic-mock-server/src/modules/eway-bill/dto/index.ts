import { IsString, IsOptional, IsArray, ValidateNested, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

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

