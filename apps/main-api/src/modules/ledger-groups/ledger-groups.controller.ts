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
import { LedgerGroupsService } from './ledger-groups.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateLedgerGroupDto, UpdateLedgerGroupDto, LedgerGroupFiltersDto } from './dto';

@Controller('ledger-groups')
@UseGuards(JwtAuthGuard)
export class LedgerGroupsController {
    constructor(private readonly ledgerGroupsService: LedgerGroupsService) { }

    @Post()
    create(
        @CurrentUser('organizationId') organizationId: string,
        @CurrentUser('sub') userId: string,
        @Body() dto: CreateLedgerGroupDto,
    ) {
        return this.ledgerGroupsService.create(organizationId, dto, userId);
    }

    @Get()
    findAll(
        @CurrentUser('organizationId') organizationId: string,
        @Query() filters: LedgerGroupFiltersDto,
    ) {
        return this.ledgerGroupsService.findAll(organizationId, filters);
    }

    @Get('hierarchy')
    getHierarchy(@CurrentUser('organizationId') organizationId: string) {
        return this.ledgerGroupsService.getHierarchy(organizationId);
    }

    @Get(':id')
    findOne(
        @CurrentUser('organizationId') organizationId: string,
        @Param('id') id: string,
    ) {
        return this.ledgerGroupsService.findById(organizationId, id);
    }

    @Put(':id')
    update(
        @CurrentUser('organizationId') organizationId: string,
        @Param('id') id: string,
        @Body() dto: UpdateLedgerGroupDto,
    ) {
        return this.ledgerGroupsService.update(organizationId, id, dto);
    }

    @Delete(':id')
    remove(
        @CurrentUser('organizationId') organizationId: string,
        @Param('id') id: string,
    ) {
        return this.ledgerGroupsService.remove(organizationId, id);
    }
}