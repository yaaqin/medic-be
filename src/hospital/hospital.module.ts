// src/hospital/hospital.module.ts

import { Module } from '@nestjs/common';
import { HospitalController } from './hospital.controller';
import { HospitalService } from './hospital.service';
import { PrismaModule } from '../prisma/prisma.module';
import { SuiService } from '../common/services/sui.service';
import { CryptoService } from '../common/services/crypto.service';

@Module({
  imports: [PrismaModule],
  controllers: [HospitalController],
  providers: [HospitalService, SuiService, CryptoService],
  exports: [HospitalService, SuiService], // SuiService di-export untuk RecordsModule nanti
})
export class HospitalModule {}