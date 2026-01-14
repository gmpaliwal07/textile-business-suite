import { Body, Controller, HttpCode, HttpStatus, Post } from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { OtpService } from "./otp.service";
import { SendOtpDto, VerifyOtpDto } from "./dto";


@ApiTags('OTP')
@Controller('otp')
export class OtpController {

    constructor(private readonly otpService: OtpService) { }

    @Post('send')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Send OTP to phone or email' })
    @ApiResponse({ status: 200, description: 'OTP sent successfully' })
    @ApiResponse({ status: 429, description: 'Too many requests' })

    async sendOtp(@Body() dto: SendOtpDto) {
        return await this.otpService.sendOtp(dto);
    }

    @Post('verify')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Verify OTP' })
    @ApiResponse({ status: 200, description: 'OTP verified successfully' })
    @ApiResponse({ status: 400, description: 'Invalid OTP' })
    async verifyOtp(@Body() dto: VerifyOtpDto) {
        return this.otpService.verifyOtp(dto);
    }

    @Post('resend')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Resend OTP' })
    async resendOtp(@Body() dto: SendOtpDto) {
        return this.otpService.resendOtp(dto);
    }
}