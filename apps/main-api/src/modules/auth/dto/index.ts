import { IsString, IsEmail, IsOptional, IsBoolean, Length, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SendOtpDto {
    @ApiProperty({ example: '9876543210', required: false })
    @IsOptional()
    @IsString()
    phone?: string;

    @ApiProperty({ example: 'user@example.com', required: false })
    @IsOptional()
    @IsEmail()
    email?: string;

    @ApiProperty({ example: "email", enum: ['email', 'sms'] })
    @IsString()
    @IsIn(['email', 'sms'])
    channel!: string;

    @ApiProperty({ example: 'login', enum: ['login', 'signup', 'reset_password'] })
    @IsString()
    @IsIn(['login', 'signup', 'reset_password'])
    type!: string;
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

    @ApiProperty({ example: false, required: false })
    @IsOptional()
    @IsBoolean()
    isSignup?: boolean;

    @ApiProperty({ example: 'John Doe', required: false })
    @IsOptional()
    @IsString()
    fullName?: string;

    @ApiProperty({ example: 'Raj Textiles', required: false })
    @IsOptional()
    @IsString()
    businessName?: string;
}

export class LoginDto {
    @ApiProperty({ example: 'user@example.com' })
    @IsEmail()
    email!: string;

    @ApiProperty({ example: '9876543210' })
    @IsString()
    phone?: string;

    @ApiProperty({ example: '123456' })
    @IsString()
    @Length(6, 6)
    otpCode!: string;
}

export class RefreshTokenDto {
    @ApiProperty()
    @IsString()
    refreshToken!: string;
}