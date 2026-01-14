import {
  Injectable,
  BadRequestException,
  BadGatewayException,
} from '@nestjs/common';
import { RedisService } from '../redis/redis.services';
import { EmailService } from '../email/email.services';
import { SmsService } from '../sms/sms.services';
import { SendOtpDto, VerifyOtpDto } from './dto';
import { utils, constants } from '@textile/shared';
@Injectable()
export class OtpService {
  private readonly OTP_EXPIRY = constants.APP_CONFIG.OTP_EXPIRY_MINUTE;
  private readonly MAX_ATTEMPTS = constants.APP_CONFIG.OTP_MAX_ATTEMPTS;
  private readonly RATE_LIMIT = 100;
  private readonly RATE_LIMIT_WINDOW = 60 * 60;

  constructor(
    private readonly redisService: RedisService,
    private readonly emailService: EmailService,
    private readonly smsService: SmsService,
  ) { }

  async sendOtp(dto: SendOtpDto) {
    const { phone, email, type, channel } = dto;
    const identifier = phone || email;

    if (!identifier) {
      throw new BadRequestException('Phone or email is required');
    }

    // Check rate limit
    await this.checkRateLimit(identifier);

    // Generate OTP
    const otpCode = utils.generateOTP(6);

    // Store OTP in Redis
    const otpKey = `otp:${identifier}`;

    await this.redisService.set(
      otpKey,
      JSON.stringify({
        code: otpCode,
        type,
        attempts: 0,
        createdAt: new Date().toISOString(),
      }),
      this.OTP_EXPIRY * 60, // convert to seconds cause it expects seconds
    );
    console.log('Storing OTP in Redis:', otpKey, 'value:', otpCode, 'TTL(s):', this.OTP_EXPIRY * 60);


    // Send OTP via preferred channel
    if (channel === 'email' || email) {
      await this.emailService.sendOtp(email!, otpCode, type);
    } else if (channel === 'sms' || phone) {
      await this.smsService.sendOtp(phone!, otpCode, type);
    }

    await this.incrementRateLimit(identifier);

    return {
      success: true,
      message: 'OTP sent successfully',
      expiresAt: new Date(Date.now() + this.OTP_EXPIRY * 60 * 1000),
      channel: channel || (email ? 'email' : 'sms'),
    };
  }
  async verifyOtp(dto: VerifyOtpDto) {
    const { phone, email, otpCode } = dto;
    const identifier = phone || email;

    if (!identifier) {
      throw new BadRequestException('Phone or email is required');
    }

    const otpKey = `otp:${identifier}`;
    const storedData = await this.redisService.get(otpKey);
    console.log('Stored data from Redis:', storedData);

    if (!storedData) {
      throw new BadRequestException('OTP expired or not found');
    }

    const otpData = JSON.parse(storedData);

    if (otpData.attempts >= this.MAX_ATTEMPTS) {
      await this.redisService.del(otpKey);
      throw new BadRequestException('Maximum OTP attempts exceeded');
    }

    if (otpData.code !== otpCode) {
      otpData.attempts += 1;

      if (otpData.attempts >= this.MAX_ATTEMPTS) {

        await this.redisService.del(otpKey);
        throw new BadRequestException('Maximum OTP attempts exceeded');
      } else {
        await this.redisService.set(
          otpKey,
          JSON.stringify(otpData),
          this.OTP_EXPIRY * 60,
        );

        throw new BadRequestException(
          `Invalid OTP. ${this.MAX_ATTEMPTS - otpData.attempts} attempts remaining`,
        );
      }
    }

    await this.redisService.del(otpKey);

    return {
      success: true,
      message: 'OTP verified successfully',
      identifier,
    };
  }


  async resendOtp(dto: SendOtpDto) {
    const identifier = dto.phone || dto.email;
    const otpKey = `otp:${identifier}`;

    const existingOtp = await this.redisService.get(otpKey);
    if (existingOtp) {
      throw new BadRequestException('Previous OTP is still valid');
    }

    return this.sendOtp(dto);
  }

  private async checkRateLimit(identifier: string) {
    const rateLimitKey = `otp:ratelimit:${identifier}`;
    const count = await this.redisService.get(rateLimitKey);

    if (count && parseInt(count) >= this.RATE_LIMIT) {
      throw new BadGatewayException(
        'Too many OTP requests. Please try again later',
      );
    }
  }

  private async incrementRateLimit(identifier: string) {
    const rateLimitKey = `otp:ratelimit:${identifier}`;
    const current = await this.redisService.get(rateLimitKey);

    if (current) {
      await this.redisService.incr(rateLimitKey);
    } else {
      await this.redisService.set(
        rateLimitKey,
        '1',
        this.RATE_LIMIT_WINDOW,
      );
    }
  }
}