import {
    Injectable,
    UnauthorizedException,
    BadRequestException,
    NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosError } from 'axios';
import { UsersService } from '../users/users.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { LoginDto, RefreshTokenDto, SendOtpDto, VerifyOtpDto } from './dto';
import { RedisService } from '../../common/redis/redis.service';

@Injectable()
export class AuthService {
    private otpServiceUrl: string;

    constructor(
        private jwtService: JwtService,
        private configService: ConfigService,
        private usersService: UsersService,
        private organizationsService: OrganizationsService,
        private redisService: RedisService,
    ) {
        this.otpServiceUrl = this.configService.get('OTP_SERVICE_URL') || 'http://localhost:3001';
    }

    async sendOtp(dto: SendOtpDto) {
        try {
            const response = await axios.post(
                `${this.otpServiceUrl}/otp/send`,
                {
                    email: dto.email,
                    type: dto.type,
                    channel: dto.channel,
                },
                {
                    timeout: 30000,
                    headers: {
                        'Content-Type': 'application/json'
                    }
                }
            );

            return response.data;

        } catch (error) {
            if (error instanceof AxiosError) {
                if (error.code === 'ECONNREFUSED') {
                    throw new BadRequestException('OTP service is not available');
                }
                if (error.code === 'ETIMEDOUT') {
                    throw new BadRequestException('OTP service request timed out');
                }

                throw new BadRequestException(
                    error.response?.data?.message || 'Failed to send OTP'
                );
            }
            throw new BadRequestException('Failed to send OTP');
        }
    }

    /**
     * ✅ IMPROVED: Verify OTP and login/signup
     */
    async verifyOtpAndLogin(dto: VerifyOtpDto) {
        // ✅ Verify OTP first
        try {
            const verifyResponse = await axios.post(
                `${this.otpServiceUrl}/otp/verify`,
                {
                    email: dto.email,
                    otpCode: dto.otpCode,
                },
                {
                    timeout: 30000,
                    headers: {
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (!verifyResponse.data.success) {
                throw new UnauthorizedException('Invalid OTP');
            }
        } catch (error) {
            if (error instanceof AxiosError) {
                if (error.code === 'ECONNREFUSED') {
                    throw new BadRequestException('OTP service is not available');
                }
                if (error.code === 'ETIMEDOUT') {
                    throw new BadRequestException('OTP service request timed out');
                }

                if (error.response?.data?.message) {
                    throw new UnauthorizedException(error.response.data.message);
                }
            }

            if (error instanceof UnauthorizedException || error instanceof BadRequestException) {
                throw error;
            }

            throw new UnauthorizedException('OTP verification failed');
        }

        // ✅ Check if user exists
        let user = await this.usersService.findByPhoneOrEmail(dto.email!);

        // ✅ If user doesn't exist and isSignup is false, block login
        if (!user && dto.isSignup === false) {
            throw new NotFoundException('User not found. Please signup first');
        }

        // ✅ If user doesn't exist and isSignup is true, create new user + org
        if (!user && dto.isSignup === true) {
            if (!dto.fullName || !dto.businessName) {
                throw new BadRequestException('Full name and business name required for signup');
            }

            const organization = await this.organizationsService.create({
                businessName: dto.businessName,
                phone: dto.phone || 'Not provided',
                addressLine1: 'Not provided',
                city: 'Not provided',
                state: 'Gujarat',
                pincode: '395001',
            });

            user = await this.usersService.create({
                organizationId: organization.id,
                fullName: dto.fullName,
                phone: dto.phone,
                email: dto.email,
                role: 'owner',
            });
        }

        // ✅ Update last login
        try {
            await this.usersService.updateLastLoginAt(user!.id, 'unknown');
        } catch (error) {
            console.warn('Failed to update last login:', error);
        }

        return this.generateAuthResponse(user!);
    }

    async login(dto: LoginDto) {
        const verifyDto: VerifyOtpDto = {
            email: dto.email,
            otpCode: dto.otpCode,
            isSignup: false,
        };

        return this.verifyOtpAndLogin(verifyDto);
    }

    async refreshToken(dto: RefreshTokenDto) {
        try {
            const payload = this.jwtService.verify(dto.refreshToken, {
                secret: this.configService.get('JWT_REFRESH_SECRET'),
            });

            const user = await this.usersService.findById(payload.sub);
            if (!user) {
                throw new UnauthorizedException('User not found');
            }

            return this.generateAuthResponse(user);
        } catch (error) {
            throw new UnauthorizedException('Invalid refresh token');
        }
    }

    async getProfile(userId: string) {
        const user = await this.usersService.findById(userId);
        if (!user) {
            throw new NotFoundException('User not found');
        }

        const organization = await this.organizationsService.findById(user.organizationId);

        return {
            user: this.sanitizeUser(user),
            organization,
        };
    }

    async logout(userId: string, token: string) {
        if (!token) {
            return { success: true, message: 'Logged out (no active token)' };
        }

        let decoded: any;

        try {
            decoded = this.jwtService.decode(token);
        } catch {
            return { success: true, message: 'Logged out' };
        }

        if (!decoded || !decoded.exp) {
            return { success: true, message: 'Logged out' };
        }

        const now = Math.floor(Date.now() / 1000);
        const expiresIn = decoded.exp - now;

        if (expiresIn > 0) {
            await this.redisService.addToBlacklist(token, expiresIn);
        }

        return { success: true, message: 'Logged out successfully' };
    }

    private async generateAuthResponse(user: any) {
        const payload = {
            sub: user.id,
            organizationId: user.organizationId,
            role: user.role,
            permissions: user.permissions,
        };

        const accessToken = this.jwtService.sign(payload);
        const refreshToken = this.jwtService.sign(payload, {
            secret: this.configService.get('JWT_REFRESH_SECRET'),
            expiresIn: '30d',
        });

        const organization = await this.organizationsService.findById(user.organizationId);

        return {
            success: true,
            accessToken,
            refreshToken,
            user: this.sanitizeUser(user),
            organization: {
                id: organization.id,
                businessName: organization.businessName,
                subscriptionStatus: organization.subscriptionStatus,
                trialEndsAt: organization.trialEndsAt,
            },
        };
    }

    private sanitizeUser(user: any) {
        const { passwordHash: _passwordHash, ...sanitized } = user;
        return sanitized;
    }

    async validateUser(userId: string) {
        return this.usersService.findById(userId);
    }
}