import { Module } from '@nestjs/common';
import { PatientController } from './patient.controller';
import { PatientService } from './patient.service';
import { CryptoService } from '../common/services/crypto.service';
import { SuiService } from '../common/services/sui.service';

@Module({
  controllers: [PatientController],
  providers: [PatientService, CryptoService, SuiService],
  exports: [PatientService],
})
export class PatientModule {}
