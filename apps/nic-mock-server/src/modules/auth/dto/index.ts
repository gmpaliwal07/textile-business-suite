import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    username!: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    password!: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    app_key!: string;
}

export class VerifyDto {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    token!: string;
}