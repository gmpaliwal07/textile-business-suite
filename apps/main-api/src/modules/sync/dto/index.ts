import { IsString, IsEnum, IsObject, IsDateString, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

// ============================================
// SINGLE SYNC REQUEST DTO
// ============================================

export class SyncRequestDto {
    @ApiProperty({ enum: ['invoice', 'payment', 'party', 'product'] })
    @IsEnum(['invoice', 'payment', 'party', 'product'])
    entityType!: string;

    @ApiProperty({ enum: ['create', 'update', 'delete'] })
    @IsEnum(['create', 'update', 'delete'])
    action!: string;

    @ApiProperty({ example: 'local-uuid-123' })
    @IsString()
    localId!: string;

    @ApiProperty()
    @IsObject()
    data: any;

    @ApiProperty()
    @IsDateString()
    timestamp!: string;
}

// ============================================
// BATCH SYNC REQUEST DTO
// ============================================

export class BatchSyncDto {
    @ApiProperty({ type: [SyncRequestDto] })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => SyncRequestDto)
    requests!: SyncRequestDto[];
}
