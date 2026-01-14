    import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
    import { ApiOperation, ApiTags } from '@nestjs/swagger';
    import { AuthService } from './auth.service';
    import { LoginDto, VerifyDto } from './dto';
    import { NICAuthGuard } from './auth.guard';

    @ApiTags('Auth')
    @Controller('auth')
    export class AuthController {
        constructor(private readonly authService: AuthService) { }

        @Post('login')
        @HttpCode(HttpStatus.OK)
        @ApiOperation({ summary: 'Login with username and password' })
        async login(@Body() dto: LoginDto) {
            return this.authService.login(dto);
        }

        @UseGuards(NICAuthGuard)
        @Post('verify')
        @HttpCode(HttpStatus.OK)
        @ApiOperation({ summary: 'Verify token' })
        async verify(@Body() dto: VerifyDto) {
            return this.authService.verify(dto.token);
        }
    }
