import { Injectable, OnModuleInit, OnModuleDestroy } from "@nestjs/common";

import { ConfigService } from "@nestjs/config";
import { Redis } from "ioredis";

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
    private redis!: Redis;


    constructor(private configService: ConfigService) { }

    async onModuleInit() {
        const url = this.configService.get<string>('REDIS_URL') ?? 'redis://localhost:6379';
        this.redis = new Redis(url);

        this.redis.on('connect', () => {
            console.log('Redis connected!!');
        });

        this.redis.on('error', (err) => {
            console.error(' Redis error: ', err);
        });
    }

    async onModuleDestroy() {
        await this.redis.quit();
    }

    async get(key: string): Promise<string | null> {
        return this.redis.get(key);
    }

    async set(key: string, value: string, expireSeconds?: number): Promise<void> {
        if (expireSeconds) {
            await this.redis.setex(key, expireSeconds, value);
        } else {
            await this.redis.set(key, value);
        }
    }

    async del(key: string): Promise<void> {
        await this.redis.del(key);
    }

    async incr(key: string): Promise<number> {
        return this.redis.incr(key);
    }

    async exists(key: string): Promise<boolean> {
        return (await this.redis.exists(key)) === 1;
    }
}
