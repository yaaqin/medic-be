import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtPatientStrategy } from './strategies/jwt-patient.strategy';
import { JwtHospitalStrategy } from './strategies/jwt-hospital.strategy';
import { CryptoService } from '../common/services/crypto.service';
import { SuiService } from '../common/services/sui.service';
import { RedisService } from '../common/services/redis.service';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({}), // secret dikonfigurasi per-sign di service
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtPatientStrategy,
    JwtHospitalStrategy,
    CryptoService,
    SuiService,
    RedisService,
  ],
  exports: [AuthService, CryptoService, SuiService, RedisService],
})
export class AuthModule {}
