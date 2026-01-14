import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
    private client!: Redis;

    constructor(private configService: ConfigService) { }

    async onModuleInit() {
        this.client = new Redis(
            this.configService.get('REDIS_URL') || 'redis://localhost:6379',
            {
                retryStrategy: (times) => {
                    const delay = Math.min(times * 50, 2000);
                    return delay;
                },
            }
        );

        this.client.on('connect', () => {
            console.log(' Redis connected');
        });

        this.client.on('error', (err) => {
            console.error(' Redis error:', err);
        });
    }

    async onModuleDestroy() {
        await this.client.quit();
    }



    async addToBlacklist(token: string, expiresIn: number) {
        const key = `blacklist:${token}`;
        await this.client.setex(key, expiresIn, '1');
    }

    async isBlacklisted(token: string): Promise<boolean> {
        const key = `blacklist:${token}`;
        const result = await this.client.exists(key);
        return result === 1;
    }



    async get(key: string): Promise<string | null> {
        return this.client.get(key);
    }

    async set(key: string, value: string, ttl?: number): Promise<void> {
        if (ttl) {
            await this.client.setex(key, ttl, value);
        } else {
            await this.client.set(key, value);
        }
    }

    async del(key: string): Promise<void> {
        await this.client.del(key);
    }

    async exists(key: string): Promise<boolean> {
        return (await this.client.exists(key)) === 1;
    }



    async getJSON<T>(key: string): Promise<T | null> {
        const data = await this.client.get(key);
        return data ? JSON.parse(data) : null;
    }

    async setJSON(key: string, value: any, ttl?: number): Promise<void> {
        const data = JSON.stringify(value);
        if (ttl) {
            await this.client.setex(key, ttl, data);
        } else {
            await this.client.set(key, data);
        }
    }

    async incr(key: string): Promise<number> {
        return this.client.incr(key);
    }

    async expire(key: string, seconds: number): Promise<void> {
        await this.client.expire(key, seconds);
    }
}