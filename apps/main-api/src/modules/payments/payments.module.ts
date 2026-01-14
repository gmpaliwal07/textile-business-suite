import { Module } from "@nestjs/common";

import { PaymentsService } from "./payments.service";
import { PaymentsController } from "./payments.controller";
import { VouchersModule } from "../vouchers/vouchers.module";
import { LedgersModule } from "../ledgers/ledgers.module";


@Module({
    imports: [
        VouchersModule,
        LedgersModule
    ],
    controllers: [PaymentsController],
    providers: [PaymentsService],
    exports: [PaymentsService],
})

export class PaymentsModule { }