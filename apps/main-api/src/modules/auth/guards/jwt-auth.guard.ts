import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RedisService } from '../../../common/redis/redis.service';
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
    constructor(private redisService: RedisService) {
        super();
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const token = this.extractTokenFromHeader(request);

        if (token) {
            const isBlacklisted = await this.redisService.isBlacklisted(token);
            if (isBlacklisted) {
                throw new UnauthorizedException('Token has been revoked');
            }
            request.token = token; // Make token available to controller/service
        }

        return super.canActivate(context) as Promise<boolean>;
    }

    handleRequest(err: any, user: any) {
        if (err || !user) {
            throw err || new UnauthorizedException('Invalid or missing token');
        }
        return user;
    }

    private extractTokenFromHeader(request: any): string | null {
        const authHeader = request.headers.authorization;
        if (!authHeader) return null;

        const [type, token] = authHeader.split(' ');
        return type === 'Bearer' ? token : null;
    }
}
