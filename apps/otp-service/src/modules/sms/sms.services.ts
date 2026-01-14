import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";


import axios from 'axios';

@Injectable()
export class SmsService {

    constructor(private configService: ConfigService) { }

    private async sendMsg91(phone: string, otpCode: string, type: string) {
        const authKey = this.configService.get('MSG91_AUTH_KEY');
        const templateId = this.configService.get('MSG91_TEMPLATE_ID');

        const url = `https://api.msg91.com/api/v5/otp`;

        await axios.post(
            url,
            {
                template_id: templateId,
                mobile: phone,
                authkey: authKey,
                otp: otpCode,
                type: type,
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                },
            },
        );
    }

    private async sendFast2SMS(phone: string, otpCode: string, type: string) {
        const apiKey = this.configService.get('FAST2SMS_API_KEY');
        const message = `Your OTP for ${type} is ${otpCode}. Valid for 5 minutes.`;

        const url = `https://www.fast2sms.com/dev/bulkV2`;

        await axios.get(url, {
            params: {
                authorization: apiKey,
                variables_values: otpCode,
                route: 'otp',
                numbers: phone,
                message,
            },
        });
    }

    private async send2Factor(phone: string, otpCode: string) {
        const apiKey = this.configService.get('TWOFACTOR_API_KEY');

        const url = `https://2factor.in/API/V1/${apiKey}/SMS/${phone}/${otpCode}`;

        await axios.get(url);
    }
    async sendOtp(phone: string, otp: string, type: string
    ): Promise<void> {
        const provider = this.configService.get('SMS_PROVIDER') || 'msg91';
        try {

            switch (provider) {
                case 'msg91':
                    await this.sendMsg91(phone, otp, type);
                    break;
                case 'fast2sms':
                    await this.sendFast2SMS(phone, otp, type);
                    break;
                case '2factor':
                    await this.send2Factor(phone, otp);
                    break;
                default:
                    throw new Error('Invalid SMS provider');
            }
        } catch (error) {
            console.error('Error sending SMS:', error);
            throw error;
        }
    }
}