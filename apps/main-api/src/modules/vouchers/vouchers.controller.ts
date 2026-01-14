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
    BadRequestException,
} from '@nestjs/common';
import { VouchersService } from './vouchers.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import {
    CreateVoucherDto,
    UpdteVoucherDto,
    VoucherFiltersDto,
    CancelVoucherDto,
} from './dto';

@Controller('vouchers')
@UseGuards(JwtAuthGuard)
export class VouchersController {
    constructor(private readonly vouchersService: VouchersService) { }

    @Post()
    create(
        @CurrentUser('organizationId') organizationId: string,
        @CurrentUser('sub') userId: string,
        @Body() dto: CreateVoucherDto,
    ) {
        return this.vouchersService.create(organizationId, dto, userId);
    }

    @Get()
    findAll(
        @CurrentUser('organizationId') organizationId: string,
        @Query() filters: VoucherFiltersDto,
    ) {
        return this.vouchersService.findAll(organizationId, filters);
    }

    @Get('day-book')
    getDayBook(
        @CurrentUser('organizationId') organizationId: string,
        @Query('startDate') startDate: string,
        @Query('endDate') endDate: string,
    ) {
        if (!startDate || !endDate) {
            throw new BadRequestException('startDate and endDate are required');
        }
        return this.vouchersService.getDayBook(
            organizationId,
            new Date(startDate),
            new Date(endDate),
        );
    }
    @Get('by-reference/:referenceType/:referenceId')
    getByReference(
        @CurrentUser('organizationId') organizationId: string,
        @Param('referenceType') referenceType: string,
        @Param('referenceId') referenceId: string,
    ) {
        return this.vouchersService.getByReference(organizationId, referenceType, referenceId);
    }
    @Get(':id')
    findOne(
        @CurrentUser('organizationId') organizationId: string,
        @Param('id') id: string,
    ) {
        return this.vouchersService.findById(organizationId, id);
    }
    @Put(':id')
    update(
        @CurrentUser('organizationId') organizationId: string,
        @CurrentUser('sub') userId: string,
        @Param('id') id: string,
        @Body() dto: UpdteVoucherDto,
    ) {
        return this.vouchersService.update(organizationId, id, dto, userId);
    }
    @Post(':id/cancel')
    cancel(
        @CurrentUser('organizationId') organizationId: string,
        @CurrentUser('sub') userId: string,
        @Param('id') id: string,
        @Body() dto: CancelVoucherDto,
    ) {
        return this.vouchersService.cancel(organizationId, id, dto, userId);
    }
    @Delete(':id')
    remove(
        @CurrentUser('organizationId') organizationId: string,
        @Param('id') id: string,
    ) {
        return this.vouchersService.remove(organizationId, id);
    }
}
