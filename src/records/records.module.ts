import { Module } from '@nestjs/common';
import { RecordsController } from './records.controller';
import { RecordsService } from './records.service';
import { PrismaModule } from '../prisma/prisma.module';
import { HospitalModule } from '../hospital/hospital.module';
import { CryptoService } from '@/common/services/crypto.service';

@Module({
  imports: [
    PrismaModule,
    HospitalModule, // expose getHospitalKeypair
  ],
  controllers: [RecordsController],
  providers: [RecordsService, CryptoService],
  exports: [RecordsService], // expose ke EBG module nanti
})
export class RecordsModule {} 