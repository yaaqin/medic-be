import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

export interface JwtAdminPayload {
    sub: string;      // deployer wallet address
    address: string;
    role: 'ADMIN';
}

@Injectable()
export class JwtAdminStrategy extends PassportStrategy(Strategy, 'jwt-admin') {
    constructor(private readonly config: ConfigService) {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: config.get<string>('jwt.adminSecret') ?? 'fallback-admin-secret',
        });
    }

    async validate(payload: JwtAdminPayload) {
        if (payload.role !== 'ADMIN') {
            throw new UnauthorizedException('Bukan admin');
        }
        return {
            sub: payload.sub,
            address: payload.address,
            role: 'ADMIN' as const,
        };
    }
}