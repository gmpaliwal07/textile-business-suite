import {
    Body,
    Controller,
    Get,
    Put,
    Param,
    Delete,
    HttpCode,
    HttpStatus
} from "@nestjs/common";

import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";

import { UsersService } from "./users.service";
import { UpdateUserDto } from "./dto";
@ApiTags('Users')
@Controller('users')
export class UsersController {

    constructor(private readonly userService: UsersService) { }

    @Get('lookup/:identifier')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Find User by phone or email' })
    @ApiResponse({ status: 200, description: 'User found' })
    async findByPhoneOrEmail(@Param('identifier') identifier: string) {
        return this.userService.findByPhoneOrEmail(identifier);
    }

    @Get('org/:orgId')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Find Users by Organization ID' })
    @ApiResponse({ status: 200, description: 'Users found' })
    async findByOrg(@Param('orgId') orgId: string) {
        return this.userService.findByOrg(orgId);
    }

    @Put(':id')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Update User' })
    @ApiResponse({ status: 200, description: 'User updated' })
    async update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
        return this.userService.update(id, dto);
    }

    @Delete(':id')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Remove User (soft delete)' })
    @ApiResponse({ status: 200, description: 'User removed' })
    async remove(@Param('id') id: string) {
        return this.userService.remove(id);
    }

    @Get(':id')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Find User by ID' })
    @ApiResponse({ status: 200, description: 'User found' })
    async findById(@Param('id') id: string) {
        return this.userService.findById(id);
    }
}
