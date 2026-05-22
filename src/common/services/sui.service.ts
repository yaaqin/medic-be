import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SuiClient, getFullnodeUrl } from '@mysten/sui.js/client';
import { TransactionBlock } from '@mysten/sui.js/transactions';
import { Ed25519Keypair } from '@mysten/sui.js/keypairs/ed25519';
import { fromB64 } from '@mysten/sui.js/utils';

@Injectable()
export class SuiService {
  private readonly logger = new Logger(SuiService.name);
  private readonly client: SuiClient;
  private readonly adminKeypair: Ed25519Keypair;
  private readonly packageId: string;
  private readonly patientRegistryId: string;
  private readonly recordRegistryId: string;
  private readonly feeConfigId: string;
  private readonly paymentPoolId: string;
  private readonly ebgRegistryId: string;

  constructor(private readonly config: ConfigService) {
    const network = this.config.get<string>('sui.network') ?? 'testnet';
    const rpcUrl =
      this.config.get<string>('sui.rpcUrl') ??
      getFullnodeUrl(network as 'mainnet' | 'testnet' | 'devnet');

    this.client = new SuiClient({ url: rpcUrl });

    const adminPrivKey = this.config.get<string>('sui.adminPrivateKey') ?? '';
    if (adminPrivKey) {
      try {
        const raw = fromB64(adminPrivKey.replace('suiprivkey1q', ''));
        this.adminKeypair = Ed25519Keypair.fromSecretKey(raw.slice(1));
        this.logger.log('✅ Sui admin keypair loaded');
      } catch (e) {
        this.logger.warn(`⚠️  Failed to load admin keypair: ${(e as Error).message}`);
      }
    } else {
      this.logger.warn('⚠️  SUI_ADMIN_PRIVATE_KEY not set — blockchain writes disabled');
    }

    this.packageId = this.config.get<string>('sui.packageId') ?? '';
    this.patientRegistryId = this.config.get<string>('sui.patientRegistryId') ?? '';
    this.recordRegistryId = this.config.get<string>('sui.recordRegistryId') ?? '';
    this.feeConfigId = this.config.get<string>('sui.feeConfigId') ?? '';
    this.paymentPoolId = this.config.get<string>('sui.paymentPoolId') ?? '';
    this.ebgRegistryId = this.config.get<string>('sui.ebgRegistryId') ?? '';

    this.logger.log(`✅ Sui client connected — network: ${network}`);
  }

  // ─────────────────────────────────────────────────
  // PATIENT REGISTRY
  // ─────────────────────────────────────────────────

  async registerPatientOnChain(params: {
    patientCode: string;
    nikHash: string;
    ibuKandungHash: string;
    walletPubkey: string;
    patientName: string;
  }): Promise<string> {
    if (!this.packageId) return this.mockTxHash('register_patient');

    const tx = new TransactionBlock();
    tx.moveCall({
      target: `${this.packageId}::patient_registry::register_patient`,
      arguments: [
        tx.object(this.patientRegistryId),
        tx.pure(params.patientCode),
        tx.pure(params.nikHash),
        tx.pure(params.ibuKandungHash),
        tx.pure(params.walletPubkey),
        tx.pure(params.patientName),
        tx.pure(Date.now()),
      ],
    });

    return this.executeTransaction(tx);
  }

  async getPatientByNikHash(nikHash: string): Promise<any | null> {
    if (!this.packageId) return null;

    try {
      const result = await this.client.devInspectTransactionBlock({
        transactionBlock: (() => {
          const tx = new TransactionBlock();
          tx.moveCall({
            target: `${this.packageId}::patient_registry::get_patient_by_nik_hash`,
            arguments: [
              tx.object(this.patientRegistryId),
              tx.pure(nikHash),
            ],
          });
          return tx;
        })(),
        sender: this.adminKeypair?.getPublicKey().toSuiAddress() ?? '0x0',
      });

      return result;
    } catch (e) {
      this.logger.error('getPatientByNikHash failed', e);
      return null;
    }
  }

  // ─────────────────────────────────────────────────
  // RECORD MANAGEMENT
  // ─────────────────────────────────────────────────

  async createRecordOnChain(params: {
    recordId: string;
    patientNikHash: string;
    hospitalId: string;
    dataHash: string;
    ipfsRef: string;
  }): Promise<string> {
    if (!this.packageId) return this.mockTxHash('create_record');

    const tx = new TransactionBlock();
    tx.moveCall({
      target: `${this.packageId}::record_management::create_record`,
      arguments: [
        tx.object(this.recordRegistryId),
        tx.pure(params.recordId),
        tx.pure(params.patientNikHash),
        tx.pure(params.hospitalId),
        tx.pure(params.dataHash),
        tx.pure(params.ipfsRef),
        tx.pure(Date.now()),
      ],
    });

    return this.executeTransaction(tx);
  }

  async getPatientRecords(nikHash: string): Promise<any[]> {
    if (!this.packageId) return [];

    try {
      // Query events untuk patient records
      const events = await this.client.queryEvents({
        query: {
          MoveEventType: `${this.packageId}::record_management::RecordCreated`,
        },
      });

      return events.data
        .filter((e: any) => e.parsedJson?.patient_nik_hash === nikHash)
        .map((e: any) => e.parsedJson);
    } catch (e) {
      this.logger.error('getPatientRecords failed', e);
      return [];
    }
  }

  // ─────────────────────────────────────────────────
  // ACCESS LOGGING
  // ─────────────────────────────────────────────────

  async logAccessOnChain(params: {
    patientNikHash: string;
    accessingHospital: string;
    accessedRecords: string[];
    purpose: string;
  }): Promise<string> {
    if (!this.packageId) return this.mockTxHash('log_access');

    const tx = new TransactionBlock();
    tx.moveCall({
      target: `${this.packageId}::access_log::log_access`,
      arguments: [
        tx.object(this.recordRegistryId),
        tx.pure(params.patientNikHash),
        tx.pure(params.accessingHospital),
        tx.pure(params.accessedRecords),
        tx.pure(params.purpose),
        tx.pure(Date.now()),
      ],
    });

    return this.executeTransaction(tx);
  }

  // ─────────────────────────────────────────────────
  // EMERGENCY BREAK GLASS
  // ─────────────────────────────────────────────────

  async logEbgInitiated(params: {
    ebgId: string;
    doctorId: string;
    doctorStr: string;
    hospitalId: string;
    patientNikHash: string;
    emergencyType: string;
    justificationHash: string;
    sessionId: string;
  }): Promise<string> {
    if (!this.packageId) return this.mockTxHash('ebg_initiated');

    const tx = new TransactionBlock();
    tx.moveCall({
      target: `${this.packageId}::emergency_access::log_initiated`,
      arguments: [
        tx.object(this.ebgRegistryId),
        tx.pure(params.ebgId),
        tx.pure(params.doctorId),
        tx.pure(params.doctorStr),
        tx.pure(params.hospitalId),
        tx.pure(params.patientNikHash),
        tx.pure(params.emergencyType),
        tx.pure(params.justificationHash),
        tx.pure(params.sessionId),
        tx.pure(Date.now()),
      ],
    });

    return this.executeTransaction(tx);
  }

  async logEbgCompleted(params: {
    ebgId: string;
    sessionId: string;
    recordsAccessed: string[];
    sessionDurationSeconds: number;
  }): Promise<string> {
    if (!this.packageId) return this.mockTxHash('ebg_completed');

    const tx = new TransactionBlock();
    tx.moveCall({
      target: `${this.packageId}::emergency_access::log_completed`,
      arguments: [
        tx.object(this.ebgRegistryId),
        tx.pure(params.ebgId),
        tx.pure(params.sessionId),
        tx.pure(params.recordsAccessed),
        tx.pure(params.sessionDurationSeconds),
        tx.pure(Date.now()),
      ],
    });

    return this.executeTransaction(tx);
  }

  // ─────────────────────────────────────────────────
  // INTERNALS
  // ─────────────────────────────────────────────────

  private async executeTransaction(tx: TransactionBlock): Promise<string> {
    if (!this.adminKeypair) {
      return this.mockTxHash('no_keypair');
    }

    try {
      const result = await this.client.signAndExecuteTransactionBlock({
        transactionBlock: tx,
        signer: this.adminKeypair,
        options: { showEffects: true },
      });

      const txHash = result.digest;
      this.logger.log(`✅ TX executed: ${txHash}`);
      return txHash;
    } catch (e) {
      this.logger.error('Transaction failed', e);
      throw e;
    }
  }

  /** Dev helper — return fake TX hash ketika blockchain belum dikonfigurasi */
  private mockTxHash(label: string): string {
    const hash = '0xMOCK_' + label + '_' + Date.now();
    this.logger.warn(`[MOCK] TX hash: ${hash}`);
    return hash;
  }

  getClient(): SuiClient {
    return this.client;
  }
}
