import { Injectable, ConflictException } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { GenerateEwbDto, CancelEwbDto, UpdateVehicleDto } from './dto';

@Injectable()
export class EwayBillService {
    constructor(private readonly redisService: RedisService) { }

    private generateEwbNumber(): string {
        return Math.floor(100000000000 + Math.random() * 900000000000).toString();
    }

    private calculateValidity(): string {
        const d = new Date();
        d.setDate(d.getDate() + 1); // +1 day
        return d.toISOString();
    }

    async generateEwb(dto: GenerateEwbDto, user: any) {
        // Validate mandatory fields
        if (!dto.items || dto.items.length === 0) throw new ConflictException('Items required');

        const ewayBillNo = this.generateEwbNumber();
        const ewayBillDate = new Date().toISOString();
        const validUpto = this.calculateValidity();

        const ewbRecord = {
            ewayBillNo,
            ewayBillDate,
            validUpto,
            doc: {
                docNo: dto.docNo,
                docDate: dto.docDate,
                docType: dto.docType,
            },
            from: {
                gstin: dto.fromGstin,
                tradeName: dto.fromTradeName,
                addr1: dto.fromAddr1,
                pincode: dto.fromPincode,
                stateCode: dto.fromStateCode,
            },
            to: {
                gstin: dto.toGstin,
                tradeName: dto.toTradeName,
                addr1: dto.toAddr1,
                pincode: dto.toPincode,
                stateCode: dto.toStateCode,
            },
            transport: {
                transportMode: dto.transportMode,
                vehicleNumber: dto.vehicleNumber,
                transporterId: dto.transporterId,
                transporterDocNumber: dto.transporterDocNumber,
                transporterDocDate: dto.transporterDocDate,
                distance: dto.distance,
            },
            items: dto.items,
            user,
            isCancelled: false,
        };

        await this.redisService.set(`ewaybill:${ewayBillNo}`, JSON.stringify(ewbRecord));

        return {
            status: 'SUCCESS',
            ewayBillNo,
            ewayBillDate,
            validUpto,
        };
    }

    async getEwb(ewayBillNo: string) {
        const data = await this.redisService.get(`ewaybill:${ewayBillNo}`);
        if (!data) throw new ConflictException('EWB not found');
        return JSON.parse(data);
    }

    async cancelEwb(dto: CancelEwbDto, user: any) {
        const key = `ewaybill:${dto.ewayBillNo}`;
        const data = await this.redisService.get(key);
        if (!data) throw new ConflictException('EWB not found');

        const ewb = JSON.parse(data);
        ewb.isCancelled = true;
        ewb.cancelledBy = user.username;
        ewb.cancelledAt = new Date().toISOString();
        ewb.cancellationReason = dto.cancellationReason;

        await this.redisService.set(key, JSON.stringify(ewb));

        return {
            status: 'SUCCESS',
            ewayBillNo: ewb.ewayBillNo,
            cancelledAt: ewb.cancelledAt,
        };
    }

    async updateVehicle(dto: UpdateVehicleDto) {
        const key = `ewaybill:${dto.ewayBillNo}`;
        const data = await this.redisService.get(key);
        if (!data) throw new ConflictException('EWB not found');

        const ewb = JSON.parse(data);
        ewb.transport.vehicleNumber = dto.vehicleNumber || ewb.transport.vehicleNumber;
        ewb.transport.transporterId = dto.transporterId || ewb.transport.transporterId;
        ewb.transport.transporterDocNumber = dto.transporterDocNumber || ewb.transport.transporterDocNumber;
        ewb.transport.transporterDocDate = dto.transporterDocDate || ewb.transport.transporterDocDate;

        await this.redisService.set(key, JSON.stringify(ewb));

        return {
            status: 'SUCCESS',
            ewayBillNo: ewb.ewayBillNo,
        };
    }
}
