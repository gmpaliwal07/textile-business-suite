import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';
import { Request } from 'express';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor(
        private readonly configService: ConfigService,
        private readonly authService: AuthService,
    ) {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: configService.get('JWT_SECRET'),
            passReqToCallback: true,
        });
    }

    async validate(request: Request, payload: any) {
        console.log('🔐 JWT Strategy validate - payload:', payload);

        const user = await this.authService.validateUser(payload.sub);

        if (!user) {
            console.error('❌ User not found for ID:', payload.sub);
            throw new UnauthorizedException('User not found');
        }

        console.log('✅ JWT validated successfully for user:', user.id);

        return {
            id: user.id,
            organizationId: user.organizationId,
            role: user.role,
            permissions: user.permissions,
        };
    }
}