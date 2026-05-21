// src/modules/patient/patient.module.ts
import { Module } from '@nestjs/common';
import { PatientService } from './patient.service';
import { PatientController } from './patient.controller';
import { CryptoModule } from '../crypto/crypto.module';
import { BlockchainModule } from '../blockchain/blockchain.module';

@Module({
  imports: [CryptoModule, BlockchainModule],
  providers: [PatientService],
  controllers: [PatientController],
  exports: [PatientService],
})
export class PatientModule {}