// src/common/services/sui.service.ts
// REPLACE file lama dengan ini

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SuiClient, getFullnodeUrl } from '@mysten/sui.js/client';
import { TransactionBlock } from '@mysten/sui.js/transactions';
import { Ed25519Keypair } from '@mysten/sui.js/keypairs/ed25519';
import { fromB64 } from '@mysten/sui.js/utils';

@Injectable()
export class SuiService {
  private readonly logger = new Logger(SuiService.name);
  readonly client: SuiClient;
  private readonly adminKeypair: Ed25519Keypair | null = null;

  // Contract IDs
  private readonly packageId: string;
  private readonly patientRegistryId: string;
  private readonly recordRegistryId: string;
  private readonly feeConfigId: string;
  private readonly ebgRegistryId: string;
  private readonly doctorRegistryId: string;

  constructor(private readonly config: ConfigService) {
    const network = this.config.get<string>('sui.network') ?? 'testnet';
    const rpcUrl =
      this.config.get<string>('sui.rpcUrl') ?? getFullnodeUrl(network as any);

    this.client = new SuiClient({ url: rpcUrl });

    // Load admin keypair
    const adminPrivKey = this.config.get<string>('sui.adminPrivateKey') ?? '';
    if (adminPrivKey) {
      try {
        this.adminKeypair = this.parseKeypair(adminPrivKey);
        this.logger.log('✅ Sui admin keypair loaded');
      } catch (e) {
        this.logger.warn(`⚠️  Failed to load admin keypair: ${(e as Error).message}`);
      }
    } else {
      this.logger.warn('⚠️  SUI_ADMIN_PRIVATE_KEY not set — blockchain writes disabled');
    }

    this.packageId          = this.config.get<string>('sui.packageId') ?? '';
    this.patientRegistryId  = this.config.get<string>('sui.patientRegistryId') ?? '';
    this.recordRegistryId   = this.config.get<string>('sui.recordRegistryId') ?? '';
    this.feeConfigId        = this.config.get<string>('sui.feeConfigId') ?? '';
    this.ebgRegistryId      = this.config.get<string>('sui.ebgRegistryId') ?? '';
    this.doctorRegistryId   = this.config.get<string>('sui.doctorRegistryId') ?? '';

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
    const clockObj = tx.object('0x6'); // Sui system clock

    tx.moveCall({
      target: `${this.packageId}::patient_registry::register_patient`,
      arguments: [
        tx.object(this.patientRegistryId),
        tx.pure(params.patientCode),
        tx.pure(params.nikHash),
        tx.pure(params.ibuKandungHash),
        tx.pure(params.walletPubkey),
        tx.pure(params.patientName),
        clockObj,
      ],
    });

    return this.executeTransaction(tx);
  }

  async getPatientRecords(nikHash: string): Promise<any[]> {
    if (!this.packageId) return [];

    try {
      const events = await this.client.queryEvents({
        query: {
          MoveEventType: `${this.packageId}::medical_records::RecordCreated`,
        },
        limit: 50,
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
  // DOCTOR REGISTRY
  // ─────────────────────────────────────────────────

  async verifyDoctorOnChain(params: {
    doctorId: string;
    nikHash: string;
    strNumber: string;
    sipNumber: string;
    hospitalId: string;
    specialization: string;
  }): Promise<string> {
    if (!this.packageId) return this.mockTxHash('verify_doctor');

    const tx = new TransactionBlock();
    const clockObj = tx.object('0x6');

    tx.moveCall({
      target: `${this.packageId}::doctor_registry::verify_doctor`,
      arguments: [
        tx.object(this.config.get<string>('sui.doctorAdminCapId') ?? ''),
        tx.object(this.doctorRegistryId),
        tx.pure(params.doctorId),
        tx.pure(params.nikHash),
        tx.pure(params.strNumber),
        tx.pure(params.sipNumber),
        tx.pure(params.hospitalId),
        tx.pure(params.specialization),
        clockObj,
      ],
    });

    return this.executeTransaction(tx);
  }

  // ─────────────────────────────────────────────────
  // MEDICAL RECORDS
  // ─────────────────────────────────────────────────

  /**
   * Create medical record on-chain.
   * Gas disponsori oleh hospital keypair (bukan admin).
   */
  async createRecordOnChain(
    params: {
      recordId: string;
      patientNikHash: string;
      hospitalId: string;       // hospitalCode e.g. "RSUD-BEKASI"
      doctorId: string;         // staffCode e.g. "DOC-0001"
      ipfsRef: string;
      dataHash: string;
      recordType: string;
      feePaid: number;          // dalam base units SGT (0 jika fee disabled)
    },
    hospitalKeypair: Ed25519Keypair, // hospital wallet sebagai gas sponsor
  ): Promise<string> {
    if (!this.packageId) return this.mockTxHash('create_record');

    const tx = new TransactionBlock();
    const clockObj = tx.object('0x6');

    tx.moveCall({
      target: `${this.packageId}::medical_records::create_record`,
      arguments: [
        tx.object(this.recordRegistryId),
        tx.object(this.patientRegistryId),
        tx.object(this.feeConfigId),
        tx.pure(params.recordId),
        tx.pure(params.patientNikHash),
        tx.pure(params.hospitalId),
        tx.pure(params.doctorId),
        tx.pure(params.ipfsRef),
        tx.pure(params.dataHash),
        tx.pure(params.recordType),
        tx.pure(params.feePaid),
        clockObj,
      ],
    });

    // Sign dengan hospital wallet, bukan admin
    return this.executeTransaction(tx, hospitalKeypair);
  }

  /**
   * Log access on-chain.
   * Gas disponsori hospital keypair.
   */
  async logAccessOnChain(
    params: {
      accessId: string;
      patientNikHash: string;
      accessingHospital: string;
      recordIds: string[];
      purpose: string;
    },
    hospitalKeypair: Ed25519Keypair,
  ): Promise<string> {
    if (!this.packageId) return this.mockTxHash('log_access');

    const tx = new TransactionBlock();
    const clockObj = tx.object('0x6');

    tx.moveCall({
      target: `${this.packageId}::medical_records::log_access`,
      arguments: [
        tx.object(this.recordRegistryId),
        tx.pure(params.accessId),
        tx.pure(params.patientNikHash),
        tx.pure(params.accessingHospital),
        tx.pure(params.recordIds),
        tx.pure(params.purpose),
        clockObj,
      ],
    });

    return this.executeTransaction(tx, hospitalKeypair);
  }

  // ─────────────────────────────────────────────────
  // EMERGENCY BREAK GLASS
  // ─────────────────────────────────────────────────

  async logEbgInitiated(params: {
    ebgId: string;
    doctorId: string;
    patientNikHash: string;
    emergencyType: string;
    justificationHash: string;
    sessionId: string;
  }): Promise<string> {
    if (!this.packageId) return this.mockTxHash('ebg_initiated');

    const tx = new TransactionBlock();
    const clockObj = tx.object('0x6');

    tx.moveCall({
      target: `${this.packageId}::emergency_break_glass::initiate_emergency_access`,
      arguments: [
        tx.object(this.ebgRegistryId),
        tx.object(this.doctorRegistryId),
        tx.object(this.patientRegistryId),
        tx.pure(params.ebgId),
        tx.pure(params.doctorId),
        tx.pure(params.patientNikHash),
        tx.pure(params.emergencyType),
        tx.pure(params.justificationHash),
        tx.pure(params.sessionId),
        clockObj,
      ],
    });

    return this.executeTransaction(tx);
  }

  async logEbgCompleted(params: {
    ebgId: string;
    recordsAccessed: string[];
  }): Promise<string> {
    if (!this.packageId) return this.mockTxHash('ebg_completed');

    const tx = new TransactionBlock();
    const clockObj = tx.object('0x6');

    tx.moveCall({
      target: `${this.packageId}::emergency_break_glass::complete_emergency_access`,
      arguments: [
        tx.object(this.ebgRegistryId),
        tx.pure(params.ebgId),
        tx.pure(params.recordsAccessed),
        clockObj,
      ],
    });

    return this.executeTransaction(tx);
  }

  // ─────────────────────────────────────────────────
  // INTERNALS
  // ─────────────────────────────────────────────────

  /**
   * Execute TX — pakai hospitalKeypair kalau ada, fallback ke adminKeypair.
   */
  private async executeTransaction(
    tx: TransactionBlock,
    signer?: Ed25519Keypair,
  ): Promise<string> {
    const keypair = signer ?? this.adminKeypair;
    if (!keypair) return this.mockTxHash('no_keypair');

    try {
      const result = await this.client.signAndExecuteTransactionBlock({
        transactionBlock: tx,
        signer: keypair,
        options: { showEffects: true },
      });
      this.logger.log(`✅ TX: ${result.digest}`);
      return result.digest;
    } catch (e) {
      this.logger.error('Transaction failed', e);
      throw e;
    }
  }

  /**
   * Parse berbagai format Sui private key.
   */
  parseKeypair(key: string): Ed25519Keypair {
    // Format suiprivkey1q...
    if (key.startsWith('suiprivkey1q')) {
      const raw = fromB64(key.replace('suiprivkey1q', ''));
      return Ed25519Keypair.fromSecretKey(raw.slice(1));
    }
    // Format hex 64 char
    if (/^[0-9a-fA-F]{64}$/.test(key)) {
      return Ed25519Keypair.fromSecretKey(Buffer.from(key, 'hex'));
    }
    // Format base64
    const raw = fromB64(key);
    return Ed25519Keypair.fromSecretKey(raw.length === 33 ? raw.slice(1) : raw);
  }

  private mockTxHash(label: string): string {
    const hash = `0xMOCK_${label}_${Date.now()}`;
    this.logger.warn(`[MOCK] TX: ${hash}`);
    return hash;
  }

  getClient(): SuiClient {
    return this.client;
  }
}