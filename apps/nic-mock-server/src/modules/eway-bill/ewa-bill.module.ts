import { Module } from '@nestjs/common';
import { EwayBillService } from './eway-bill.service';
import { EwayBillController } from './eway-bill.controller';
import { RedisModule } from '../redis/redis.module';
import { AuthModule } from '../auth/auth.module';

@Module({
    imports: [RedisModule, AuthModule],
    providers: [EwayBillService],
    controllers: [EwayBillController],
    exports: [EwayBillService]
})
export class EwayBillModule { }
