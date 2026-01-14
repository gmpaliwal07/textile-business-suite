import { Module } from '@nestjs/common';
import { PartiesController } from './parties.controller';
import { PartiesService } from './parties.service';
import { LedgersModule } from '../ledgers/ledgers.module';

@Module({
    imports: [LedgersModule],
    controllers: [PartiesController],
    providers: [PartiesService],
    exports: [PartiesService],
})
export class PartiesModule { }
