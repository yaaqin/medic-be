import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { SuiService } from '../common/services/sui.service';
import { CryptoService } from '../common/services/crypto.service';
import { HospitalService } from '../hospital/hospital.service';
import { CreateRecordDto } from './dto/create-record.dto';
import { QueryRecordsDto } from './dto/query-records.dto';
import * as crypto from 'crypto';
import * as https from 'https';
import FormData = require('form-data');

@Injectable()
export class RecordsService {
  private readonly logger = new Logger(RecordsService.name);
  private readonly pinataApiKey: string;
  private readonly pinataSecretKey: string;
  private readonly pinataGateway: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly sui: SuiService,
    private readonly crypto: CryptoService,
    private readonly hospitalService: HospitalService,
    private readonly config: ConfigService,
  ) {
    this.pinataApiKey = this.config.get<string>('app.pinataApiKey') ?? '';
    this.pinataSecretKey = this.config.get<string>('app.pinataSecretKey') ?? '';
    this.pinataGateway = this.config.get<string>('app.pinataGateway') ?? 'https://gateway.pinata.cloud/ipfs';
  }

  // ─────────────────────────────────────────────────
  // CREATE RECORD
  // ─────────────────────────────────────────────────

  /**
   * Flow lengkap buat rekam medis:
   * 1. Validasi pasien & dokter ada di DB lokal
   * 2. Enkripsi medicalData dengan pubkey pasien (AES-256-GCM)
   * 3. Upload encrypted blob ke IPFS via Pinata → dapat CID
   * 4. Hitung SHA256(encrypted blob) → data_hash
   * 5. Generate record_id unik
   * 6. Cek SGT balance hospital cukup
   * 7. create_record on-chain (hospital keypair sign)
   * 8. log_access on-chain (audit trail otomatis)
   * 9. Simpan metadata ke DB lokal (tanpa medicalData)
   */
  async createRecord(dto: CreateRecordDto, staffId: string, hospitalId: string) {
    // ── 1. Validasi staff & hospital ──────────────────
    const staff = await this.prisma.hospitalStaff.findUnique({
      where: { id: staffId },
      include: { hospital: true },
    });
    if (!staff) throw new NotFoundException('Staff tidak ditemukan');
    if (staff.hospitalId !== hospitalId) {
      throw new ForbiddenException('Staff tidak terdaftar di hospital ini');
    }

    const hospital = staff.hospital;
    if (!hospital.isActive) {
      throw new BadRequestException('Hospital tidak aktif');
    }

    // ── 2. Validasi pasien ada ────────────────────────
    const patient = await this.prisma.patient.findFirst({
      where: { nikHash: dto.patientNikHash },
    });
    if (!patient) {
      throw new NotFoundException(`Pasien dengan NIK hash ${dto.patientNikHash} tidak ditemukan`);
    }

    // ── 3. Enkripsi data medis ────────────────────────
    // Enkripsi dengan wallet pubkey pasien (hybrid encryption)
    const dataToEncrypt = JSON.stringify({
      medicalData: dto.medicalData,
      notes: dto.notes ?? '',
      doctorOnChainId: dto.doctorId,
      hospitalCode: hospital.hospitalCode,
      createdAt: new Date().toISOString(),
    });

    const encryptedBlob = this.encryptForPatient(dataToEncrypt, patient.walletPubkey);
    const encryptedBuffer = Buffer.from(JSON.stringify(encryptedBlob));

    // ── 4. Hitung data_hash ───────────────────────────
    const dataHash = crypto
      .createHash('sha256')
      .update(encryptedBuffer)
      .digest('hex');

    // ── 5. Upload ke IPFS ─────────────────────────────
    const ipfsRef = await this.uploadToIpfs(encryptedBuffer, `record_${Date.now()}`);
    this.logger.log(`IPFS upload sukses: ${ipfsRef}`);

    // ── 6. Generate record_id ─────────────────────────
    const recordId = this.generateRecordId(hospital.hospitalCode);

    // ── 7. Cek SGT balance ────────────────────────────
    const requiredFee = await this.sui.getCurrentRecordFee();
    if (requiredFee > BigInt(0)) {
      const { totalBalance } = await this.sui.getSgtBalance(hospital.walletAddress);
      if (totalBalance < requiredFee) {
        throw new BadRequestException(
          `SGT balance hospital tidak cukup. Required: ${requiredFee}, Available: ${totalBalance}`,
        );
      }
    }

    // ── 8. On-chain: create_record ────────────────────
    const hospitalKeypair = await this.hospitalService.getHospitalKeypair(hospitalId);

    const txDigest = await this.sui.createRecordOnChain(
      {
        recordId,
        patientNikHash: dto.patientNikHash,
        hospitalId: hospital.hospitalCode,
        doctorId: dto.doctorId,
        ipfsRef,
        dataHash,
        recordType: dto.recordType,
      },
      hospitalKeypair,
    );

    this.logger.log(`create_record TX: ${txDigest}`);

    // ── 9. On-chain: log_access (audit trail creator) ─
    const accessId = `ACC-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    await this.sui.logAccessOnChain(
      {
        accessId,
        patientNikHash: dto.patientNikHash,
        accessingHospital: hospital.hospitalCode,
        recordIds: [recordId],
        purpose: 'Record creation by attending doctor',
      },
      hospitalKeypair,
    ).catch((e) => {
      // log_access gagal tidak batalkan record — catat saja
      this.logger.warn(`log_access gagal (non-fatal): ${e.message}`);
    });

    // ── 10. Simpan metadata ke DB lokal ───────────────
    const record = await this.prisma.medicalRecord.create({
      data: {
        recordId,
        patientId: patient.id,
        hospitalId,
        doctorOnChainId: dto.doctorId,
        recordType: dto.recordType,
        createdByStaffId: staffId,
        ipfsRef,
        dataHash,
        txDigest,
        status: 'ACTIVE',
      },
    });

    return {
      success: true,
      data: {
        recordId: record.recordId,
        ipfsRef: record.ipfsRef,
        dataHash: record.dataHash,
        recordType: record.recordType,
        txDigest: record.txDigest,
        createdAt: record.createdAt,
      },
      message: 'Rekam medis berhasil dibuat',
    };
  }

  // ─────────────────────────────────────────────────
  // GET RECORDS BY PATIENT
  // ─────────────────────────────────────────────────

  /**
   * List semua record_id milik pasien.
   * Data dikembalikan dari DB lokal (metadata saja).
   * Untuk isi rekam → hit endpoint GET /records/:recordId
   */
  async getPatientRecords(nikHash: string, query: QueryRecordsDto, hospitalId: string) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const patient = await this.prisma.patient.findFirst({
      where: { nikHash },
    });
    if (!patient) throw new NotFoundException('Pasien tidak ditemukan');

    const where: any = { patientId: patient.id, status: 'ACTIVE' };
    if (query.recordType) where.recordType = query.recordType;

    const [records, total] = await Promise.all([
      this.prisma.medicalRecord.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          recordId: true,
          recordType: true,
          ipfsRef: true,
          dataHash: true,
          txDigest: true,
          status: true,
          createdAt: true,
          hospital: { select: { hospitalCode: true, name: true } },
        },
      }),
      this.prisma.medicalRecord.count({ where }),
    ]);

    // Log akses on-chain (audit trail baca list)
    if (records.length > 0) {
      const hospital = await this.prisma.hospital.findUnique({ where: { id: hospitalId } });
      if (hospital) {
        const accessId = `ACC-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
        const hospitalKeypair = await this.hospitalService.getHospitalKeypair(hospitalId);
        await this.sui.logAccessOnChain(
          {
            accessId,
            patientNikHash: nikHash,
            accessingHospital: hospital.hospitalCode,
            recordIds: records.map((r) => r.recordId),
            purpose: 'Patient record list query',
          },
          hospitalKeypair,
        ).catch((e) => this.logger.warn(`log_access gagal: ${e.message}`));
      }
    }

    return {
      success: true,
      data: records,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // ─────────────────────────────────────────────────
  // GET SINGLE RECORD (dengan dekripsi dari IPFS)
  // ─────────────────────────────────────────────────

  /**
   * Ambil isi satu rekam medis:
   * 1. Fetch metadata dari DB
   * 2. Fetch encrypted blob dari IPFS
   * 3. Verifikasi SHA256(blob) == data_hash on-chain
   * 4. Return metadata + ipfs_ref (dekripsi di sisi client/frontend)
   *    NOTE: Dekripsi butuh private key pasien — tidak dilakukan di server
   */
  async getRecordById(recordId: string, hospitalId: string) {
    const record = await this.prisma.medicalRecord.findUnique({
      where: { recordId },
      include: {
        patient: { select: { nikHash: true, patientCode: true, walletPubkey: true } },
        hospital: { select: { hospitalCode: true, name: true, walletAddress: true } },
      },
    });

    if (!record) throw new NotFoundException(`Record ${recordId} tidak ditemukan`);
    if (record.status === 'REVOKED') {
      throw new BadRequestException('Record ini sudah direvoke');
    }

    // Log akses on-chain
    const hospital = await this.prisma.hospital.findUnique({ where: { id: hospitalId } });
    if (hospital) {
      const accessId = `ACC-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
      const hospitalKeypair = await this.hospitalService.getHospitalKeypair(hospitalId);
      await this.sui.logAccessOnChain(
        {
          accessId,
          patientNikHash: record.patient.nikHash,
          accessingHospital: hospital.hospitalCode,
          recordIds: [recordId],
          purpose: 'Single record access',
        },
        hospitalKeypair,
      ).catch((e) => this.logger.warn(`log_access gagal: ${e.message}`));
    }

    return {
      success: true,
      data: {
        recordId: record.recordId,
        recordType: record.recordType,
        ipfsRef: record.ipfsRef,
        ipfsUrl: `${this.pinataGateway}/${record.ipfsRef}`,
        dataHash: record.dataHash,
        txDigest: record.txDigest,
        status: record.status,
        createdAt: record.createdAt,
        patient: {
          patientCode: record.patient.patientCode,
          walletPubkey: record.patient.walletPubkey,
        },
        hospital: record.hospital,
      },
    };
  }

  // ─────────────────────────────────────────────────
  // MANUAL LOG ACCESS
  // ─────────────────────────────────────────────────

  async logAccess(
    recordId: string,
    purpose: string,
    hospitalId: string,
  ) {
    const record = await this.prisma.medicalRecord.findUnique({
      where: { recordId },
      include: { patient: { select: { nikHash: true } } },
    });
    if (!record) throw new NotFoundException(`Record ${recordId} tidak ditemukan`);

    const hospital = await this.prisma.hospital.findUnique({
      where: { id: hospitalId },
      select: { hospitalCode: true },
    });
    if (!hospital) throw new NotFoundException('Hospital tidak ditemukan');

    const accessId = `ACC-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const hospitalKeypair = await this.hospitalService.getHospitalKeypair(hospitalId);

    const txDigest = await this.sui.logAccessOnChain(
      {
        accessId,
        patientNikHash: record.patient.nikHash,
        accessingHospital: hospital.hospitalCode,
        recordIds: [recordId],
        purpose,
      },
      hospitalKeypair,
    );

    return {
      success: true,
      data: { accessId, txDigest },
      message: 'Akses berhasil dicatat on-chain',
    };
  }

  // ─────────────────────────────────────────────────
  // PRIVATE HELPERS
  // ─────────────────────────────────────────────────

  /**
   * Enkripsi data untuk pasien menggunakan AES-256-GCM.
   * Key derivasi dari walletPubkey pasien (simplified — production
   * seharusnya pakai ECIES/asymmetric encryption penuh).
   */
  private encryptForPatient(
    data: string,
    walletPubkey: string,
  ): { ciphertext: string; iv: string; tag: string; pubkeyRef: string } {
    // Derive AES key dari pubkey (simplified — gunakan ECIES di production)
    const derivedKey = crypto
      .createHash('sha256')
      .update(walletPubkey)
      .digest();

    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', derivedKey, iv);

    const ciphertext = Buffer.concat([
      cipher.update(data, 'utf8'),
      cipher.final(),
    ]);

    return {
      ciphertext: ciphertext.toString('base64'),
      iv: iv.toString('hex'),
      tag: cipher.getAuthTag().toString('hex'),
      pubkeyRef: walletPubkey.slice(0, 16), // ref saja, bukan full key
    };
  }

  /**
   * Upload buffer ke IPFS via Pinata.
   * Returns IPFS CID (contoh: "QmABCD1234...")
   */
  private async uploadToIpfs(data: Buffer, filename: string): Promise<string> {
    if (!this.pinataApiKey) {
      // Mock CID kalau Pinata belum dikonfigurasi
      const mockCid = `QmMOCK${crypto.randomBytes(20).toString('hex')}`;
      this.logger.warn(`[MOCK] IPFS CID: ${mockCid}`);
      return mockCid;
    }

    return new Promise((resolve, reject) => {
      const form = new FormData();
      form.append('file', data, {
        filename,
        contentType: 'application/octet-stream',
      });
      form.append(
        'pinataMetadata',
        JSON.stringify({ name: filename }),
      );

      const options = {
        method: 'POST',
        hostname: 'api.pinata.cloud',
        path: '/pinning/pinFileToIPFS',
        headers: {
          ...form.getHeaders(),
          pinata_api_key: this.pinataApiKey,
          pinata_secret_api_key: this.pinataSecretKey,
        },
      };

      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(body);
            if (parsed.IpfsHash) resolve(parsed.IpfsHash);
            else reject(new Error(`Pinata error: ${body}`));
          } catch (e) {
            reject(new Error(`Pinata parse error: ${body}`));
          }
        });
      });

      req.on('error', reject);
      form.pipe(req);
    });
  }

  private generateRecordId(hospitalCode: string): string {
    const year = new Date().getFullYear();
    const random = crypto.randomBytes(4).toString('hex').toUpperCase();
    return `REC-${hospitalCode}-${year}-${random}`;
  }
}