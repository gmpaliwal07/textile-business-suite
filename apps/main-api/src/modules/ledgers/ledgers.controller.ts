import {
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Body,
    Param,
    Query,
    UseGuards,
} from '@nestjs/common';
import { LedgersService } from './ledgers.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateLedgerDto, UpdateLedgerDto, LedgerFiltersDto } from './dto';

@Controller('ledgers')
@UseGuards(JwtAuthGuard)
export class LedgersController {
    constructor(private readonly ledgersService: LedgersService) { }

    @Post()
    create(
        @CurrentUser('organizationId') organizationId: string,
        @CurrentUser('sub') userId: string,
        @Body() dto: CreateLedgerDto,
    ) {
        return this.ledgersService.create(organizationId, dto, userId);
    }

    @Get()
    findAll(
        @CurrentUser('organizationId') organizationId: string,
        @Query() filters: LedgerFiltersDto,
    ) {
        return this.ledgersService.findAll(organizationId, filters);
    }

    @Get(':id')
    findOne(
        @CurrentUser('organizationId') organizationId: string,
        @Param('id') id: string,
    ) {
        return this.ledgersService.findById(organizationId, id);
    }

    @Get(':id/statement')
    getLedgerStatement(
        @CurrentUser('organizationId') organizationId: string,
        @Param('id') id: string,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
    ) {
        return this.ledgersService.getLedgerStatement(
            organizationId,
            id,
            startDate ? new Date(startDate) : undefined,
            endDate ? new Date(endDate) : undefined,
        );
    }

    @Put(':id')
    update(
        @CurrentUser('organizationId') organizationId: string,
        @Param('id') id: string,
        @Body() dto: UpdateLedgerDto,
    ) {
        return this.ledgersService.update(organizationId, id, dto);
    }

    @Delete(':id')
    remove(
        @CurrentUser('organizationId') organizationId: string,
        @Param('id') id: string,
    ) {
        return this.ledgersService.remove(organizationId, id);
    }
}