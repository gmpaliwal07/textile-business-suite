import { Controller, Get, Post, Body, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AddonsService } from './addons.service';
import { WhatsAppService } from './services/whatsapp.service';
import { EInvoiceService } from './services/einvoice.service';
import { ActivateAddonDto, SendWhatsAppDto, GenerateEInvoiceDto } from './dto';

@ApiTags('Add-ons')
@Controller('addons')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AddonsController {
    constructor(
        private readonly addonsService: AddonsService,
        private readonly whatsappService: WhatsAppService,
        private readonly einvoiceService: EInvoiceService,
    ) { }

    @Get()
    @ApiOperation({ summary: 'Get available and active add-ons' })
    async getAddons(@Req() req: any) {
        return this.addonsService.getActiveAddons(req.user.organizationId);
    }

    @Post('activate')
    @ApiOperation({ summary: 'Activate an add-on' })
    async activate(@Req() req: any, @Body() dto: ActivateAddonDto) {
        return this.addonsService.activateAddon(req.user.organizationId, dto);
    }

    @Post('whatsapp/send-invoice')
    @ApiOperation({ summary: 'Send invoice via WhatsApp' })
    async sendInvoice(@Body() dto: SendWhatsAppDto) {
        // Check if WhatsApp add-on is active
        return this.whatsappService.sendInvoice(dto.phone, 'pdf-url', 'INV-001');
    }

    @Post('einvoice/generate')
    @ApiOperation({ summary: 'Generate e-invoice IRN' })
    async generateIRN(@Body() dto: GenerateEInvoiceDto) {
        // Check if e-invoice add-on is active
        return this.einvoiceService.generateIRN({ invoiceId: dto.invoiceId });
    }
}