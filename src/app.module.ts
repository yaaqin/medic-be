// src/app.module.ts (updated)
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';

import { PatientModule } from './module/patient/patient.module';
import { CryptoModule } from './module/crypto/crypto.module';
import { BlockchainModule } from './module/blockchain/blockchain.module';
import { IpfsModule } from './module/ipfs/ipfs.module';
import { AuthModule } from './module/auth/auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    AuthModule,
    PatientModule,
    CryptoModule,
    BlockchainModule,
    IpfsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}