import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { Role } from '@prisma/client';

export interface JwtHospitalPayload {
  sub: string;        // hospitalStaff.id
  staffCode: string;
  hospitalId: string;
  role: Role;
}

@Injectable()
export class JwtHospitalStrategy extends PassportStrategy(Strategy, 'jwt-hospital') {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('jwt.hospitalSecret') ?? 'fallback-hospital-secret',
    });
  }

  async validate(payload: JwtHospitalPayload) {
    const staff = await this.prisma.hospitalStaff.findUnique({
      where: { id: payload.sub },
      include: { hospital: true },
    });

    if (!staff) throw new UnauthorizedException('Staff not found');
    if (!staff.hospital.isActive) throw new UnauthorizedException('Hospital is inactive');

    return {
      id: staff.id,
      staffCode: staff.staffCode,
      name: staff.name,
      hospitalId: staff.hospitalId,
      hospitalCode: staff.hospital.hospitalCode,
      role: staff.role,
      isVerifiedDoctor: staff.isVerifiedDoctor,
      strNumber: staff.strNumber,
      sipNumber: staff.sipNumber,
    };
  }
}
