import { IsEmail, IsEnum, IsOptional, IsString } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { UserRole } from "@textile/database";

export class CreateUserDto {
    @ApiProperty()
    @IsString()
    fullName!: string;

    @ApiProperty()
    @IsString()
    phone?: string;

    @ApiProperty()
    @IsOptional()
    @IsEmail()
    email?: string;

    @ApiProperty({ enum: UserRole })
    @IsEnum(UserRole)
    role!: UserRole;

    password?: string;
    organizationId?: string;
}

export class UpdateUserDto {
    @IsOptional()
    @IsString()
    fullName?: string;

    @IsOptional()
    @IsEmail()
    email?: string;

    @IsOptional()
    @IsEnum(UserRole)
    role?: UserRole;
}
