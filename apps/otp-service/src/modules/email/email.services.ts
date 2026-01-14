import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Resend } from 'resend';
import * as fs from 'fs';
import * as path from 'path';


@Injectable()
export class EmailService {
    private resend!: Resend;

    constructor(private configService: ConfigService) {
        const api_token = this.configService.get<string>('RESEND_API_TOKEN');
        this.resend = new Resend(api_token);
    }

    private getSubject(type: string): string {
        switch (type) {
            case 'login':
                return 'Your Login OTP';
            case 'register':
                return 'Your Register OTP';
            case 'reset_password':
                return 'Your Password Reset OTP';
            default:
                return 'Verification code';
        }
    }


    private getTemplate(otp: string, type: string): string {
        console.log(`Generating OTP email template inline for type: ${type}`);

        const html = `
<!doctype html>
<html>
  <head>
    <style>
      body { font-family: Arial, sans-serif; line-height: 1.6; }
      .container { max-width: 600px; margin: 0 auto; padding: 20px; }
      .otp-box { background: #f4f4f4; border: 2px dashed #333; padding: 20px; text-align: center; margin: 20px 0; }
      .otp-code { font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #ff6b00; }
      .footer { margin-top: 30px; font-size: 12px; color: #666; }
    </style>
  </head>
  <body>
    <div class="container">
      <h2>Verification Code</h2>
      <p>Your OTP for ${type} is:</p>
      <div class="otp-box">
        <div class="otp-code">${otp}</div>
      </div>
      <p>This code will expire in 5 minutes.</p>
      <p>If you didn't request this code, please ignore this email.</p>
      <div class="footer">
        <p>This is an automated email. Please do not reply.</p>
      </div>
    </div>
  </body>
</html>
`;

        return html;
    }

    async sendOtp(email: string, otp: string, type: string) {
        const subject = this.getSubject(type);
        const template = this.getTemplate(otp, type);
        try {
            await this.resend.emails.send({
                from: this.configService.get('EMAIL_FROM') || 'onboarding@resend.dev', to: email,
                subject: subject,
                html: template
            })

            console.log(`OTP email sent to ${email} for ${type}`);
        } catch (error) {
            console.error('Error sending email:', error);
            throw error;
        }
    }

}


