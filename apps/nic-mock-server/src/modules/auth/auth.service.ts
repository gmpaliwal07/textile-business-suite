import { ConflictException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoginDto } from './dto';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class AuthService {
    constructor(private configService: ConfigService, private readonly redisService: RedisService) { }



    async login(dto: LoginDto) {
        const appKey = this.configService.get<string>('APP_KEY');

        // Validate app key
        if (dto.app_key !== appKey) {
            throw new ConflictException('Invalid app key');
        }

        // Validate required fields
        if (!dto.username || !dto.password) {
            throw new ConflictException('Missing username or password');
        }

        // Mock credential check (you can replace this later)
        if (!(dto.username === 'admin' && dto.password === 'admin')) {
            throw new ConflictException('Invalid username or password');
        }

        // Generate token
        const token = Math.random().toString(36).substring(2) + Date.now().toString(36);

        // Generate expiry (e.g. +12 hours)
        const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000);

        // Store token in Redis
        await this.redisService.set(`token:${token}`, JSON.stringify({
            username: dto.username,
            createdAt: new Date().toISOString(),
            expiresAt: expiresAt.toISOString()
        }), 12 * 60 * 60);

        // NIC-style success response
        return {
            status: 'SUCCESS',
            token,
            expiry: expiresAt.toISOString(),
        };
    }

    async verify(token: string) {
        const tokenData = await this.redisService.get(`token:${token}`);

        if (!tokenData) {
            throw new ConflictException('Invalid token');
        }

        const data = JSON.parse(tokenData);

        // Expired?
        if (new Date(data.expiresAt).getTime() < Date.now()) {
            throw new ConflictException('Token expired');
        }

        return data; // Valid token
    }

    
}