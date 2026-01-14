import { Module } from "@nestjs/common";
import { VouchersController } from "./vouchers.controller";
import { VouchersService } from "./vouchers.service";
import { VoucherGeneratorService } from "./services/voucher-generator.service";

@Module({
    controllers: [VouchersController],
    providers: [VouchersService, VoucherGeneratorService],
    exports: [VouchersService, VoucherGeneratorService]
})

export class VouchersModule { }