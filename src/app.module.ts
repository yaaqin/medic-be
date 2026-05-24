import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { PatientModule } from './patient/patient.module';
import appConfig from './config/app.config';
import jwtConfig from './config/jwt.config';
import suiConfig from './config/sui.config';
import { HospitalModule } from './hospital/hospital.module';
import { RecordsModule } from './records/records.module';

@Module({
  imports: [
    // Config — load semua config files, tersedia global
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, jwtConfig, suiConfig],
      envFilePath: '.env',
    }),

    // Rate limiting global
    ThrottlerModule.forRoot([
      {
        ttl: parseInt(process.env.THROTTLE_TTL ?? '60000'),
        limit: parseInt(process.env.THROTTLE_LIMIT ?? '100'),
      },
    ]),

    // Core
    PrismaModule,

    // Feature modules (tambah di sini per modul)
    AuthModule,
    PatientModule,
    HospitalModule,
    RecordsModule,
  ],
})
export class AppModule {}
