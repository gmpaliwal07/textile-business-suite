import { Controller, Post, Get, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BackupService } from './backup.service';

@ApiTags('Backup')
@Controller('backup')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class BackupController {
    constructor(private readonly backupService: BackupService) { }

    @Post('create')
    @ApiOperation({ summary: 'Create manual backup' })
    async createBackup(@Req() req: any) {
        return this.backupService.createBackup(req.user.organizationId);
    }

    //need to configure the supabase url

    @Get('export')
    @ApiOperation({ summary: 'Export data (local plan)' })
    async exportData(@Req() req: any) {
        return this.backupService.exportLocalBackup(req.user.organizationId);
    }
}