import { Controller, Get, Put, Post, Body, Param, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrganizationsService } from './organizations.service';
import { UpdateOrganizationDto, SetupFinancialYearDto, LockBooksDto } from './dto';

@ApiTags('Organizations')
@Controller('organizations')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class OrganizationsController {
    constructor(private readonly organizationsService: OrganizationsService) { }

    @Get('')
    @ApiOperation({ summary: 'Get current user organization' })
    async getMyOrganization(@Req() req: any) {
        return this.organizationsService.findById(req.user.organizationId);
    }

    @Put(':id')
    @ApiOperation({ summary: 'Update organization' })
    async update(@Req() req: any, @Body() dto: UpdateOrganizationDto) {
        return this.organizationsService.update(req.user.organizationId, dto);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get organization by ID' })
    async findOne(@Param('id') id: string) {
        return this.organizationsService.findById(id);
    }


    @Post(':id/setup/financial-year')
    @ApiOperation({ summary: 'Setup financial year and business type' })
    async setupFinancialYear(@Param('id') id: string, @Body() dto: SetupFinancialYearDto) {
        return this.organizationsService.setupFinancialYear(id, dto);
    }

    @Get(':id/opening-balance-status')
    @ApiOperation({ summary: 'Check opening balance tally status' })
    async getOpeningBalanceStatus(@Param('id') id: string) {
        return this.organizationsService.getOpeningBalanceStatus(id);
    }

    @Post(':id/lock-books')
    @ApiOperation({ summary: 'Lock books before a specific date' })
    async lockBooks(@Param('id') id: string, @Body() dto: LockBooksDto) {
        return this.organizationsService.lockBooks(id, dto);
    }

    @Get(':id/setup-status')
    @ApiOperation({ summary: 'Get complete setup status' })
    async getSetupStatus(@Param('id') id: string) {
        return this.organizationsService.getSetupStatus(id);
    }

    @Post(':id/verify-ledger-setup')
    @ApiOperation({ summary: 'Verify if chart of accounts is properly setup' })
    async verifyLedgerSetup(@Param('id') id: string) {
        return this.organizationsService.verifyLedgerSetup(id);
    }

    @Post(':id/deactivate')
    @ApiOperation({ summary: 'Deactivate organization (with safety checks)' })
    async deactivate(@Param('id') id: string) {
        return this.organizationsService.deactivate(id);
    }
}