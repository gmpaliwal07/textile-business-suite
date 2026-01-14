import { Module } from '@nestjs/common';
import { LedgerGroupsService } from './ledger-groups.service';
import { LedgerGroupsController } from './ledger-groups.controller';

@Module({
    controllers: [LedgerGroupsController],
    providers: [LedgerGroupsService],
    exports: [LedgerGroupsService],
})
export class LedgerGroupsModule { }