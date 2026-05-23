import { decodeSuiPrivateKey } from '@mysten/sui.js/cryptography';
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
  private readonly treasuryId: string;
  private readonly ebgRegistryId: string;
  private readonly doctorRegistryId: string;
  private readonly doctorAdminCapId: string;
  private readonly recordAdminCapId: string;
  private readonly sgtCoinType: string;

  constructor(private readonly config: ConfigService) {
    const network = this.config.get<string>('sui.network') ?? 'testnet';
    const rpcUrl =
      this.config.get<string>('sui.rpcUrl') ?? getFullnodeUrl(network as any);

    this.client = new SuiClient({ url: rpcUrl });

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

    this.packageId = this.config.get<string>('sui.packageId') ?? '';
    this.patientRegistryId = this.config.get<string>('sui.patientRegistryId') ?? '';
    this.recordRegistryId = this.config.get<string>('sui.recordRegistryId') ?? '';
    this.feeConfigId = this.config.get<string>('sui.feeConfigId') ?? '';
    this.treasuryId = this.config.get<string>('sui.treasuryId') ?? '';
    this.ebgRegistryId = this.config.get<string>('sui.ebgRegistryId') ?? '';
    this.doctorRegistryId = this.config.get<string>('sui.doctorRegistryId') ?? '';
    this.doctorAdminCapId = this.config.get<string>('sui.doctorAdminCapId') ?? '';
    this.recordAdminCapId = this.config.get<string>('sui.recordAdminCapId') ?? '';
    this.sgtCoinType = this.config.get<string>('sui.sgtCoinType') ?? '';

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
        tx.object('0x6'), // Sui system clock
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
    tx.moveCall({
      target: `${this.packageId}::doctor_registry::verify_doctor`,
      arguments: [
        tx.object(this.doctorAdminCapId),
        tx.object(this.doctorRegistryId),
        tx.pure(params.doctorId),
        tx.pure(params.nikHash),
        tx.pure(params.strNumber),
        tx.pure(params.sipNumber),
        tx.pure(params.hospitalId),
        tx.pure(params.specialization),
        tx.object('0x6'),
      ],
    });

    return this.executeTransaction(tx);
  }

  // ─────────────────────────────────────────────────
  // MEDICAL RECORDS
  // ─────────────────────────────────────────────────

  /**
   * Create medical record on-chain.
   *
   * Contract signature:
   * create_record(registry, patient_reg, fee_config, treasury,
   *               record_id, patient_nik_hash, hospital_id, doctor_id,
   *               ipfs_ref, data_hash, record_type, payment: Coin<SGT>, clock, ctx)
   *
   * Gas + SGT fee disponsori hospital wallet.
   */
  async createRecordOnChain(
    params: {
      recordId: string;
      patientNikHash: string;
      hospitalId: string;
      doctorId: string;
      ipfsRef: string;
      dataHash: string;
      recordType: string;
    },
    hospitalKeypair: Ed25519Keypair,
  ): Promise<string> {
    if (!this.packageId) return this.mockTxHash('create_record');

    const tx = new TransactionBlock();

    // Ambil SGT coin dari hospital wallet untuk bayar fee
    // splitCoin dari semua SGT coins yang dimiliki hospital
    const [sgtPayment] = tx.splitCoins(
      tx.gas, // placeholder — diganti dengan SGT coin di bawah
      [tx.pure(0)],
    );

    // Fetch SGT coins milik hospital untuk payment
    const hospitalAddress = hospitalKeypair.getPublicKey().toSuiAddress();
    const sgtCoins = await this.client.getCoins({
      owner: hospitalAddress,
      coinType: this.sgtCoinType,
    });

    if (!sgtCoins.data.length) {
      throw new Error(`Hospital ${hospitalAddress} tidak punya SGT untuk bayar fee`);
    }

    // Pakai coin SGT pertama sebagai payment (contract handle kembalian)
    const paymentCoin = tx.object(sgtCoins.data[0].coinObjectId);

    tx.moveCall({
      target: `${this.packageId}::medical_records::create_record`,
      typeArguments: [this.sgtCoinType],
      arguments: [
        tx.object(this.recordRegistryId),
        tx.object(this.patientRegistryId),
        tx.object(this.feeConfigId),
        tx.object(this.treasuryId),
        tx.pure(params.recordId),
        tx.pure(params.patientNikHash),
        tx.pure(params.hospitalId),
        tx.pure(params.doctorId),
        tx.pure(params.ipfsRef),
        tx.pure(params.dataHash),
        tx.pure(params.recordType),
        paymentCoin,
        tx.object('0x6'),
      ],
    });

    return this.executeTransaction(tx, hospitalKeypair);
  }

  /**
   * Log access on-chain — audit trail.
   *
   * Contract signature:
   * log_access(registry, access_id, patient_nik_hash, accessing_hospital,
   *            accessed_records, purpose, clock, ctx)
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
    tx.moveCall({
      target: `${this.packageId}::medical_records::log_access`,
      arguments: [
        tx.object(this.recordRegistryId),
        tx.pure(params.accessId),
        tx.pure(params.patientNikHash),
        tx.pure(params.accessingHospital),
        tx.pure(params.recordIds),
        tx.pure(params.purpose),
        tx.object('0x6'),
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
        tx.object('0x6'),
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
    tx.moveCall({
      target: `${this.packageId}::emergency_break_glass::complete_emergency_access`,
      arguments: [
        tx.object(this.ebgRegistryId),
        tx.pure(params.ebgId),
        tx.pure(params.recordsAccessed),
        tx.object('0x6'),
      ],
    });

    return this.executeTransaction(tx);
  }

  async logEbgFailed(params: {
    ebgId: string;
    reason: string;
  }): Promise<string> {
    if (!this.packageId) return this.mockTxHash('ebg_failed');

    const tx = new TransactionBlock();
    tx.moveCall({
      target: `${this.packageId}::emergency_break_glass::fail_emergency_access`,
      arguments: [
        tx.object(this.ebgRegistryId),
        tx.pure(params.ebgId),
        tx.pure(params.reason),
        tx.object('0x6'),
      ],
    });

    return this.executeTransaction(tx);
  }

  async logEbgExpired(ebgId: string): Promise<string> {
    if (!this.packageId) return this.mockTxHash('ebg_expired');

    const tx = new TransactionBlock();
    tx.moveCall({
      target: `${this.packageId}::emergency_break_glass::expire_emergency_access`,
      arguments: [
        tx.object(this.ebgRegistryId),
        tx.pure(ebgId),
        tx.object('0x6'),
      ],
    });

    return this.executeTransaction(tx);
  }

  // ─────────────────────────────────────────────────
  // SGT BALANCE
  // ─────────────────────────────────────────────────

  /**
   * Cek SGT balance suatu address.
   * Dipakai sebelum create_record untuk validasi hospital punya cukup SGT.
   */
  async getSgtBalance(address: string): Promise<{
    totalBalance: bigint;
    coins: { coinObjectId: string; balance: string }[];
  }> {
    try {
      const coins = await this.client.getCoins({
        owner: address,
        coinType: this.sgtCoinType,
      });

      const totalBalance = coins.data.reduce(
        (sum, c) => sum + BigInt(c.balance),
        BigInt(0),
      );

      return {
        totalBalance,
        coins: coins.data.map((c) => ({
          coinObjectId: c.coinObjectId,
          balance: c.balance,
        })),
      };
    } catch (e) {
      this.logger.error('getSgtBalance failed', e);
      return { totalBalance: BigInt(0), coins: [] };
    }
  }

  /**
   * Cek fee saat ini dari FeeConfig on-chain.
   * Returns fee dalam base units SGT.
   */
  async getCurrentRecordFee(): Promise<bigint> {
    try {
      const obj = await this.client.getObject({
        id: this.feeConfigId,
        options: { showContent: true },
      });

      const fields = (obj.data?.content as any)?.fields;
      if (!fields) return BigInt(0);

      const enabled = fields.record_fee_enabled;
      if (!enabled) return BigInt(0);

      // fee_sgt * SGT_DECIMALS (1_000_000_000)
      return BigInt(fields.record_fee_sgt) * BigInt(1_000_000_000);
    } catch (e) {
      this.logger.error('getCurrentRecordFee failed', e);
      return BigInt(0);
    }
  }

  // ─────────────────────────────────────────────────
  // INTERNALS
  // ─────────────────────────────────────────────────

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

  parseKeypair(key: string): Ed25519Keypair {
    if (key.startsWith('suiprivkey1')) {
      const decoded = decodeSuiPrivateKey(key);
      this.logger.log(`secretKey length: ${decoded.secretKey.length}`);
      this.logger.log(`schema: ${decoded.schema}`);
      return Ed25519Keypair.fromSecretKey(decoded.secretKey);
    }
    if (/^[0-9a-fA-F]{64}$/.test(key)) {
      return Ed25519Keypair.fromSecretKey(Buffer.from(key, 'hex'));
    }
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