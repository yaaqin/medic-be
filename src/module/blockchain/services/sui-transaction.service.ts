import { Injectable } from '@nestjs/common';
import { Transaction } from '@mysten/sui.js/transactions';
import { SuiClientService } from './sui-client.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SuiTransactionService {
  constructor(
    private suiClientService: SuiClientService,
    private configService: ConfigService,
  ) {}

  // Create medical record transaction
  async createRecord(
    patientNikHash: string,
    hospitalId: string,
    recordId: string,
    dataHash: string,
    ipfsRef: string,
  ) {
    const tx = new Transaction();
    const packageId = this.configService.get('SUI_PACKAGE_ID');
    const patientRecordsId = this.configService.get(
      'SUI_PATIENT_RECORDS_OBJECT_ID',
    );

    tx.moveCall({
      target: `${packageId}::records::create_record`,
      arguments: [
        tx.object(patientRecordsId),
        tx.pure.vector('u8', Buffer.from(patientNikHash, 'hex')),
        tx.pure.string(hospitalId),
        tx.pure.string(recordId),
        tx.pure.vector('u8', Buffer.from(dataHash, 'hex')),
        tx.pure.string(ipfsRef),
      ],
    });

    return tx;
  }

  // Log access transaction
  async logAccess(
    patientNikHash: string,
    accessingHospital: string,
    accessedRecords: string[],
    purpose: string,
  ) {
    const tx = new Transaction();
    const packageId = this.configService.get('SUI_PACKAGE_ID');
    const accessLogsId = this.configService.get('SUI_ACCESS_LOGS_OBJECT_ID');

    tx.moveCall({
      target: `${packageId}::records::log_access`,
      arguments: [
        tx.object(accessLogsId),
        tx.pure.vector('u8', Buffer.from(patientNikHash, 'hex')),
        tx.pure.string(accessingHospital),
        tx.pure.vector('string', accessedRecords),
        tx.pure.string(purpose),
      ],
    });

    return tx;
  }

  // Process payment transaction
  async processPayment(
    amount: bigint,
    exportId: string,
    patientNikHash: string,
    requesterType: string,
    requesterId: string,
  ) {
    const tx = new Transaction();
    const packageId = this.configService.get('SUI_PACKAGE_ID');
    const paymentPoolId = this.configService.get('SUI_PAYMENT_POOL_OBJECT_ID');
    const exportLogId = this.configService.get('SUI_EXPORT_LOG_OBJECT_ID');

    tx.moveCall({
      target: `${packageId}::export_payment::request_export`,
      arguments: [
        tx.object(paymentPoolId),
        tx.object(exportLogId),
        tx.pure.vector('u8', Buffer.from(patientNikHash, 'hex')),
        tx.pure.string(exportId),
        tx.pure.string(requesterType),
        tx.pure.string(requesterId),
        tx.pure.u64(amount),
      ],
    });

    return tx;
  }

  // Execute transaction
  async executeTransaction(tx: Transaction) {
    const client = this.suiClientService.getClient();
    const keypair = this.suiClientService.getAdminKeypair();

    return client.signAndExecuteTransaction({
      signer: keypair,
      transaction: tx,
      options: {
        showEffects: true,
        showEvents: true,
      },
    });
  }
}