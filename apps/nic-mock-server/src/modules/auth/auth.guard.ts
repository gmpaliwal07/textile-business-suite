import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

@Injectable()
export class NICAuthGuard implements CanActivate {
    constructor(private readonly authService: AuthService) { }

    private extractToken(request: any): string | null {
        const header = request.headers.authorization;
        if (!header) return null;

        const [type, token] = header.split(' ');
        return type === 'Bearer' ? token : null;
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const req = context.switchToHttp().getRequest();
        const token = this.extractToken(req);

        if (!token) {
            throw new UnauthorizedException('Missing token');
        }

        const data = await this.authService.verify(token);

        req.user = data;

        return true;
    }
}
