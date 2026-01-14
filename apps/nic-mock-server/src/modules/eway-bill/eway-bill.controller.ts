import { Controller, Post, Body, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { EwayBillService } from './eway-bill.service';
import { NICAuthGuard } from '../auth/auth.guard';
import { GenerateEwbDto, CancelEwbDto, UpdateVehicleDto } from './dto';

@ApiTags('E-Way Bill')
@Controller('ewaybill')
@UseGuards(NICAuthGuard)
export class EwayBillController {
    constructor(private readonly ewayBillService: EwayBillService) { }

    @Post('generate')
    @ApiOperation({ summary: 'Generate E-Way Bill' })
    async generate(@Body() dto: GenerateEwbDto, @Body('user') user: any) {
        return this.ewayBillService.generateEwb(dto, user);
    }

    @Get(':ewbNo')
    @ApiOperation({ summary: 'Get EWB by number' })
    async get(@Param('ewbNo') ewbNo: string) {
        return this.ewayBillService.getEwb(ewbNo);
    }

    @Post('cancel')
    @ApiOperation({ summary: 'Cancel EWB' })
    async cancel(@Body() dto: CancelEwbDto, @Body('user') user: any) {
        return this.ewayBillService.cancelEwb(dto, user);
    }

    @Post('update-vehicle')
    @ApiOperation({ summary: 'Update transport details' })
    async updateVehicle(@Body() dto: UpdateVehicleDto) {
        return this.ewayBillService.updateVehicle(dto);
    }
}
