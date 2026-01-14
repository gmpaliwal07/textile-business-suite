import { Controller, Post, Get, Body, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SyncService } from './sync.service';
import { BatchSyncDto } from './dto';

@ApiTags('Sync')
@Controller('sync')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SyncController {
    constructor(private readonly syncService: SyncService) { }

    @Post('batch')
    @ApiOperation({
        summary: 'Batch sync offline data',
        description: 'Syncs multiple offline changes in one request'
    })
    async batchSync(@Req() req: any, @Body() dto: BatchSyncDto) {
        return this.syncService.batchSync(req.user.organizationId, dto, req.user.id);
    }

    @Get('pending')
    @ApiOperation({ summary: 'Get pending sync items' })
    async getPending(@Req() req: any) {
        return this.syncService.getPendingSync(req.user.organizationId);
    }
}