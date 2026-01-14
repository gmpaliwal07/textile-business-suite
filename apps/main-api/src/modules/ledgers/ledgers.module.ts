import { Module } from '@nestjs/common';
import { LedgersService } from './ledgers.service';
import { LedgersController } from './ledgers.controller';
import { LedgerSetupService } from '../vouchers/services/ledger-setup.service';


@Module({
    controllers: [LedgersController],
    providers: [LedgersService, LedgerSetupService],
    exports: [LedgersService, LedgerSetupService],
})
export class LedgersModule { }