import { Module } from '@nestjs/common';
import { AuthModule } from './modules/auth/auth.module';
import { EwayBillModule } from './modules/eway-bill/ewa-bill.module';
import { ConfigModule } from '@nestjs/config';
import { RedisModule } from './modules/redis/redis.module';



@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            envFilePath: '.env',
        }),
        RedisModule,
        AuthModule,
        EwayBillModule
    ]
})

export class AppModule { }