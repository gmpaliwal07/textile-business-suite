import { BadRequestException, Injectable } from "@nestjs/common";
import { prisma } from "@textile/database";

import { ActivateAddonDto } from "./dto";

@Injectable()
export class AddonsService {

    private readonly ADDON_PRICES = {
        whatsapp: { monthly: 499, yearly: 4999 },
        sms: { monthly: 199, yearly: 1999 },
        einvoice: { monthly: 299, yearly: 2999 },
        custom_reports: { monthly: 199, yearly: 1999 },
        extra_storage: { monthly: 99, yearly: 999 },
    };
    constructor(private prisma: prisma.PrismaService) { }

    async getActiveAddons(organizationId: string) {
        const org = await this.prisma.organization.findUnique({
            where: { id: organizationId },
            select: {
                id: true,
                businessName: true,
                subscriptionPlan: true,
                subscriptionStatus: true,
            },
        });
        return {
            organization: org,
            activeAddons: [
                // Will be stored in database
            ],
            availableAddons: this.getAvailableAddons(),
        };
    }

    async activateAddon(organizationId: string, dto: ActivateAddonDto) {
        const price = this.ADDON_PRICES;

        if (!price) {
            throw new BadRequestException('Invalid add-on or billing period');
        }

        // In production:
        // 1. Create payment intent
        // 2. Verify payment
        // 3. Activate add-on
        // 4. Store in database

        return {
            success: true,
            message: `${dto.addonType} add-on activated`,
            price,
            billingPeriod: dto.billingPeriod,
            expiresAt: new Date(
                Date.now() + (dto.billingPeriod === 'yearly' ? 365 : 30) * 24 * 60 * 60 * 1000
            ),
        };
    }

    async isAddonActive(organizationId: string, addonType: string): Promise<boolean> {
        // Check in database if add-on is active and not expired
        // For now, returning false
        return false;
    }
    private getAvailableAddons() {
        return [
            {
                type: 'whatsapp',
                name: 'WhatsApp Business',
                description: 'Send invoices and reminders via WhatsApp',
                prices: this.ADDON_PRICES.whatsapp,
                features: [
                    'Send invoice PDF',
                    'Payment reminders',
                    'Outstanding notifications',
                    'Custom templates',
                ],
            },
            {
                type: 'sms',
                name: 'SMS Credits',
                description: 'Send SMS notifications',
                prices: this.ADDON_PRICES.sms,
                features: [
                    '500 SMS credits/month',
                    'Payment reminders',
                    'Low stock alerts',
                    'Custom messages',
                ],
            },
            {
                type: 'einvoice',
                name: 'E-Invoice API',
                description: 'Auto-generate IRN from GST portal',
                prices: this.ADDON_PRICES.einvoice,
                features: [
                    'Auto IRN generation',
                    'QR code on invoice',
                    'GST portal sync',
                    'Bulk e-invoicing',
                ],
            },
            {
                type: 'custom_reports',
                name: 'Custom Reports',
                description: 'Build your own reports',
                prices: this.ADDON_PRICES.custom_reports,
                features: [
                    'Custom report builder',
                    'Export to Excel/PDF',
                    'Schedule reports',
                    'Email reports',
                ],
            },
            {
                type: 'extra_storage',
                name: 'Extra Storage',
                description: 'Additional cloud storage',
                prices: this.ADDON_PRICES.extra_storage,
                features: [
                    '+5GB cloud storage',
                    'Extended backup retention',
                    'Faster sync',
                    'Priority support',
                ],
            },
        ];
    }

}

