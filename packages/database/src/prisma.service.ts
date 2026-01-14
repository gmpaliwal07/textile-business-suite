import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '../prisma/generated/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
    constructor() {
        super({
            log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
        });
    }

    async onModuleInit() {
        await this.$connect();
        console.log('Prisma connected to database');
    }

    async onModuleDestroy() {
        await this.$disconnect();
        console.log(' Prisma disconnected from database');
    }

    // Helper method for soft deletes
    async softDelete<M extends keyof PrismaClient,>(
        model: M,
        id: string
    ) {
        // @ts-expect-error – allow dynamic access
        return this[model].update({
            where: { id },
            data: { deletedAt: new Date() },
        });
    }

    cleanResult<T>(data: T): T {
        if (!data) return data;
        if (Array.isArray(data)) {
            return data.map((item) => this.cleanResult(item)) as T
        }
        if (typeof data === 'object') {
            return Object.fromEntries(
                Object.entries(data).filter(([, v]) => v !== null)
            ) as T;
        }
        return data;
    }
}