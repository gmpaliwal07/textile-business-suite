import { IsEnum, IsString } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class ActivateAddonDto {
    @ApiProperty({ enum: ['whatsapp', 'sms', 'einvoice', 'custom_reports', 'extra_storage'] })
    @IsEnum(['whatsapp', 'sms', 'einvoice', 'custom_reports', 'extra_storage'])
    addonType!: string;

    @ApiProperty({ enum: ['monthly', 'yearly'] })
    @IsEnum(['monthly', 'yearly'])
    billingPeriod!: string;
}

export class SendWhatsAppDto {
    @ApiProperty()
    @IsString()
    invoiceId!: string;

    @ApiProperty()
    @IsString()
    phone!: string;
}

export class GenerateEInvoiceDto {
    @ApiProperty()
    @IsString()
    invoiceId!: string;

    @ApiProperty()
    @IsString()
    transport!: string;
}