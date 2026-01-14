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
    Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PartiesService } from './parties.service';
import { CreatePartyDto, UpdatePartyDto, PartyFiltersDto } from './dto';

@ApiTags('Parties')
@Controller('parties')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PartiesController {
    constructor(private readonly partiesService: PartiesService) { }

    @Post()
    @ApiOperation({ summary: 'Create new party (customer/supplier)' })
    async create(@Req() req: any, @Body() dto: CreatePartyDto) {
        return this.partiesService.create(req.user.organizationId, dto, req.user.id);
    }

    @Get()
    @ApiOperation({ summary: 'Get all parties with filters' })
    @ApiQuery({ name: 'partyType', required: false })
    @ApiQuery({ name: 'search', required: false })
    @ApiQuery({ name: 'page', required: false })
    @ApiQuery({ name: 'limit', required: false })
    async findAll(@Req() req: any, @Query() filters: PartyFiltersDto) {
        return this.partiesService.findAll(req.user.organizationId, filters);
    }
    
    @Get('search')
    @ApiOperation({ summary: 'Search parties by name or phone' })
    @ApiQuery({ name: 'q', required: true })
    async search(@Req() req: any, @Query('q') query: string) {
        return this.partiesService.search(req.user.organizationId, query);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get party by ID' })
    async findOne(@Req() req: any, @Param('id') id: string) {
        return this.partiesService.findById(req.user.organizationId, id);
    }

    @Get(':id/ledger')
    @ApiOperation({ summary: 'Get party ledger (all transactions)' })
    async getLedger(@Req() req: any, @Param('id') id: string) {
        return this.partiesService.getLedger(req.user.organizationId, id);
    }

    @Put(':id')
    @ApiOperation({ summary: 'Update party' })
    async update(
        @Req() req: any,
        @Param('id') id: string,
        @Body() dto: UpdatePartyDto,
    ) {
        return this.partiesService.update(req.user.organizationId, id, dto);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Delete party (soft delete)' })
    async remove(@Req() req: any, @Param('id') id: string) {
        return this.partiesService.remove(req.user.organizationId, id);
    }
}