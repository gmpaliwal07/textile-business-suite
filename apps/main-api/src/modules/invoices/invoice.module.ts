import { Module } from '@nestjs/common';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';
import { GstCalculatorService } from './services/gst-calculator.service';
import { InvoiceGeneratorService } from './services/invoice-generator.service';
import { EWayBillService } from './services/eway-bill.service';
import { VouchersModule } from '../vouchers/vouchers.module';
import { LedgersModule } from '../ledgers/ledgers.module';
import { HttpModule } from '@nestjs/axios';

@Module({
    imports: [
        HttpModule,
        VouchersModule,
        LedgersModule
    ],
    controllers: [InvoicesController],
    providers: [
        InvoicesService,
        GstCalculatorService,
        InvoiceGeneratorService,
        EWayBillService,
    ],
    exports: [InvoicesService],
})
export class InvoicesModule { }