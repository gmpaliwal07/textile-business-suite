import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { NICAuthGuard } from './auth.guard';
import { RedisModule } from '../redis/redis.module';

@Module({
    imports: [RedisModule],
    controllers: [AuthController],
    providers: [AuthService, NICAuthGuard],
    exports: [AuthService],
})
export class AuthModule {}