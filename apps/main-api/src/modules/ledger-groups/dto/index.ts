import { PartialType } from "@nestjs/mapped-types";
import { AffectsType, GroupType } from "@textile/database";
import { Type } from "class-transformer";
import { IsBoolean, IsEnum, IsInt, IsOptional, isPort, IsString, Min } from "class-validator";

export class CreateLedgerGroupDto {
    @IsString()
    groupName!: string;

    @IsOptional()
    @IsString()
    groupCode?: string;

    @IsEnum(AffectsType)
    affects!: AffectsType;

    @IsEnum(GroupType)
    groupType!: GroupType;

    @IsOptional()
    @IsString()
    parentGroupId?: string;

    @IsOptional()
    @IsInt()
    @Min(1)
    level?: number;

    @IsOptional()
    @IsString()
    description?: string;
}


export class UpdateLedgerGroupDto extends PartialType(CreateLedgerGroupDto) {
    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}


export class LedgerGroupFiltersDto {
    @IsOptional()
    @IsInt()
    @Type(() => Number)
    @Min(1)
    page?: number = 1;


    @IsOptional()
    @IsInt()
    @Type(() => Number)
    @Min(1)
    limit?: number = 20;

    @IsOptional()
    @IsString()
    search?: string;

    @IsOptional()
    @IsEnum(GroupType)
    groupType?: GroupType;

    @IsOptional()
    @IsEnum(AffectsType)
    affects?: AffectsType;

    @IsOptional()
    @IsString()
    parentGroupId?: string;

    @IsOptional()
    @IsBoolean()
    @Type(() => Boolean)
    isActive?: boolean;

    @IsOptional()
    @IsString()
    sortBy?: string = 'groupName';

    @IsOptional()
    @IsEnum(['ASC', 'DESC'])
    sortOrder?: 'ASC' | 'DESC' = 'ASC';

}