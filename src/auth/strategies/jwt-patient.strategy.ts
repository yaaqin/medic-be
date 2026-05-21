import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

export interface JwtPatientPayload {
  sub: string;        // patient.id
  patientCode: string;
  nikHash: string;
  role: 'PATIENT';
}

@Injectable()
export class JwtPatientStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('jwt.secret') ?? 'fallback-secret',
    });
  }

  async validate(payload: JwtPatientPayload) {
    const patient = await this.prisma.patient.findUnique({
      where: { id: payload.sub },
    });

    if (!patient) throw new UnauthorizedException('Patient not found');

    return {
      id: patient.id,
      patientCode: patient.patientCode,
      nikHash: patient.nikHash,
      role: 'PATIENT' as const,
    };
  }
}
