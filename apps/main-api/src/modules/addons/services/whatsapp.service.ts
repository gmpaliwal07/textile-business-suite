import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class WhatsAppService {
    constructor(private configService: ConfigService) { }

    /**
     * Send invoice via WhatsApp
     * Using WhatsApp Business API (requires approval)
     */
    async sendInvoice(phone: string, invoicePdfUrl: string, invoiceNumber: string) {
        // Check if WhatsApp add-on is active
        // In production, integrate with WhatsApp Business API

        const whatsappApiUrl = this.configService.get('WHATSAPP_API_URL');
        const whatsappToken = this.configService.get('WHATSAPP_TOKEN');

        if (!whatsappApiUrl || !whatsappToken) {
            throw new BadRequestException('WhatsApp not configured');
        }

        // Placeholder implementation
        // Real implementation would use WhatsApp Business API
        console.log(`Sending invoice ${invoiceNumber} to ${phone}`);
        console.log(`PDF URL: ${invoicePdfUrl}`);

        return {
            success: true,
            message: 'Invoice sent via WhatsApp',
            messageId: 'wamid.xxx', // WhatsApp message ID
        };
    }

    /**
     * Send payment reminder
     */
    async sendPaymentReminder(phone: string, amount: number, dueDate: Date) {
        // Implement WhatsApp message sending
        return {
            success: true,
            message: 'Reminder sent',
        };
    }
}