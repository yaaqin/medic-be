import { Module } from '@nestjs/common';
import { SuiClientService } from './services/sui-client.service';
import { SuiTransactionService } from './services/sui-transaction.service';

@Module({
  providers: [SuiClientService, SuiTransactionService],
  exports: [SuiClientService, SuiTransactionService],
})
export class BlockchainModule {}