import { IsString, IsEmail, IsOptional, IsEnum, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum OtpType {
    LOGIN = 'login',
    SIGNUP = 'signup',
    RESET_PASSWORD = 'reset_password',
}

export enum OtpChannel {
    SMS = 'sms',
    EMAIL = 'email',
}

export class SendOtpDto {
    @ApiProperty({ example: '9876543210', required: false })
    @IsOptional()
    @IsString()
    phone?: string;

    @ApiProperty({ example: 'user@example.com', required: false })
    @IsOptional()
    @IsEmail()
    email?: string;

    @ApiProperty({ enum: OtpType, example: OtpType.LOGIN })
    @IsEnum(OtpType)
    type!: OtpType;

    @ApiProperty({ enum: OtpChannel, required: false })
    @IsOptional()
    @IsEnum(OtpChannel)
    channel?: OtpChannel;
}

export class VerifyOtpDto {
    @ApiProperty({ example: '9876543210', required: false })
    @IsOptional()
    @IsString()
    phone?: string;

    @ApiProperty({ example: 'user@example.com', required: false })
    @IsOptional()
    @IsEmail()
    email?: string;

    @ApiProperty({ example: '123456' })
    @IsString()
    @Length(6, 6)
    otpCode!: string;
}
