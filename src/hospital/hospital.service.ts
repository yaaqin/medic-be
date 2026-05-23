// src/hospital/hospital.service.ts

import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { SuiService } from '../common/services/sui.service';
import { CreateHospitalDto } from './dto/create-hospital.dto';
import { CreateInviteDto } from './dto/create-invite.dto';
import { Ed25519Keypair } from '@mysten/sui.js/keypairs/ed25519';
import { fromB64 } from '@mysten/sui.js/utils';
import * as crypto from 'crypto';

@Injectable()
export class HospitalService {
  private readonly logger = new Logger(HospitalService.name);
  private readonly encryptionKey: Buffer;

  constructor(
    private readonly prisma: PrismaService,
    private readonly sui: SuiService,
    private readonly config: ConfigService,
  ) {
    // 32-byte key untuk AES-256-GCM enkripsi wallet private key
    const keyHex = this.config.get<string>('app.walletEncryptionKey') ?? '';
    if (!keyHex || keyHex.length < 64) {
      this.logger.warn('⚠️  WALLET_ENCRYPTION_KEY tidak di-set atau terlalu pendek');
    }
    this.encryptionKey = Buffer.from(keyHex.slice(0, 64), 'hex');
  }

  // ─────────────────────────────────────────────────
  // HOSPITAL CRUD
  // ─────────────────────────────────────────────────

  async createHospital(dto: CreateHospitalDto, adminId: string) {
    // Cek duplikasi hospitalCode
    const existing = await this.prisma.hospital.findUnique({
      where: { hospitalCode: dto.hospitalCode },
    });
    if (existing) {
      throw new ConflictException(`Hospital code "${dto.hospitalCode}" sudah terdaftar`);
    }

    // Generate atau import keypair
    let keypair: Ed25519Keypair;

    if (dto.walletMode === 'generate') {
      keypair = new Ed25519Keypair();
      this.logger.log(`Generated new wallet untuk hospital ${dto.hospitalCode}`);
    } else {
      // Import dari private key yang diberikan
      if (!dto.walletPrivateKey) {
        throw new BadRequestException('walletPrivateKey wajib diisi untuk mode import');
      }
      keypair = this.parsePrivateKey(dto.walletPrivateKey);
    }

    const walletAddress = keypair.getPublicKey().toSuiAddress();
    const privateKeyHex = Buffer.from(keypair.export().privateKey).toString('hex');

    // Encrypt private key sebelum disimpan
    const { encrypted, iv } = this.encryptPrivateKey(privateKeyHex);

    // Cek walletAddress belum dipakai hospital lain
    const addressConflict = await this.prisma.hospital.findUnique({
      where: { walletAddress },
    });
    if (addressConflict) {
      throw new ConflictException('Wallet address ini sudah terdaftar di hospital lain');
    }

    const hospital = await this.prisma.hospital.create({
      data: {
        hospitalCode: dto.hospitalCode.toUpperCase(),
        name: dto.name,
        address: dto.address,
        phone: dto.phone,
        email: dto.email,
        walletAddress,
        walletEncryptedKey: encrypted,
        walletKeyIv: iv,
        registeredById: adminId,
      },
    });

    this.logger.log(`Hospital created: ${hospital.hospitalCode} | wallet: ${walletAddress}`);

    return {
      success: true,
      data: {
        id: hospital.id,
        hospitalCode: hospital.hospitalCode,
        name: hospital.name,
        walletAddress: hospital.walletAddress,
        // Private key TIDAK di-return, tapi expose sekali untuk admin simpan manual
        walletPrivateKeyOnce: `suiprivkey — simpan baik-baik, tidak akan ditampilkan lagi`,
      },
      message: 'Hospital berhasil didaftarkan',
    };
  }

  async listHospitals(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [hospitals, total] = await Promise.all([
      this.prisma.hospital.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          hospitalCode: true,
          name: true,
          address: true,
          phone: true,
          email: true,
          walletAddress: true,
          isActive: true,
          createdAt: true,
          _count: { select: { staff: true } },
        },
      }),
      this.prisma.hospital.count(),
    ]);

    return {
      success: true,
      data: hospitals,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async getHospitalById(id: string) {
    const hospital = await this.prisma.hospital.findUnique({
      where: { id },
      select: {
        id: true,
        hospitalCode: true,
        name: true,
        address: true,
        phone: true,
        email: true,
        walletAddress: true,
        isActive: true,
        createdAt: true,
        staff: {
          select: {
            id: true,
            staffCode: true,
            name: true,
            role: true,
            isVerifiedDoctor: true,
            specialization: true,
          },
        },
        _count: { select: { staff: true, inviteCodes: true } },
      },
    });

    if (!hospital) throw new NotFoundException('Hospital tidak ditemukan');

    return { success: true, data: hospital };
  }

  async toggleHospitalActive(id: string, isActive: boolean) {
    const hospital = await this.prisma.hospital.findUnique({ where: { id } });
    if (!hospital) throw new NotFoundException('Hospital tidak ditemukan');

    await this.prisma.hospital.update({ where: { id }, data: { isActive } });

    return {
      success: true,
      message: `Hospital ${isActive ? 'diaktifkan' : 'dinonaktifkan'}`,
    };
  }

  // ─────────────────────────────────────────────────
  // INVITE CODE
  // ─────────────────────────────────────────────────

  async createInviteCode(dto: CreateInviteDto) {
    const hospital = await this.prisma.hospital.findUnique({
      where: { id: dto.hospitalId },
    });
    if (!hospital) throw new NotFoundException('Hospital tidak ditemukan');
    if (!hospital.isActive) throw new BadRequestException('Hospital tidak aktif');

    const code = this.generateInviteCode();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (dto.expiresInDays ?? 7));

    const invite = await this.prisma.hospitalInviteCode.create({
      data: {
        code,
        hospitalId: dto.hospitalId,
        role: (dto.role as any) ?? 'HOSPITAL_STAFF',
        expiresAt,
      },
    });

    return {
      success: true,
      data: {
        code: invite.code,
        hospitalCode: hospital.hospitalCode,
        hospitalName: hospital.name,
        role: invite.role,
        expiresAt: invite.expiresAt,
      },
      message: `Invite code dibuat — bagikan ke staff/dokter yang akan bergabung`,
    };
  }

  async listInviteCodes(hospitalId: string) {
    const codes = await this.prisma.hospitalInviteCode.findMany({
      where: { hospitalId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        code: true,
        role: true,
        usedById: true,
        usedAt: true,
        expiresAt: true,
        createdAt: true,
      },
    });

    return { success: true, data: codes };
  }

  // ─────────────────────────────────────────────────
  // INTERNAL — dipakai SuiService untuk sign TX
  // ─────────────────────────────────────────────────

  async getHospitalKeypair(hospitalId: string): Promise<Ed25519Keypair> {
    const hospital = await this.prisma.hospital.findUnique({
      where: { id: hospitalId },
      select: { walletEncryptedKey: true, walletKeyIv: true, hospitalCode: true },
    });

    if (!hospital) throw new NotFoundException('Hospital tidak ditemukan');

    const privateKeyHex = this.decryptPrivateKey(
      hospital.walletEncryptedKey,
      hospital.walletKeyIv,
    );

    return Ed25519Keypair.fromSecretKey(Buffer.from(privateKeyHex, 'hex'));
  }

  // ─────────────────────────────────────────────────
  // PRIVATE HELPERS
  // ─────────────────────────────────────────────────

  private parsePrivateKey(key: string): Ed25519Keypair {
    try {
      // Format suiprivkey1q...
      if (key.startsWith('suiprivkey1q')) {
        const raw = fromB64(key.replace('suiprivkey1q', ''));
        return Ed25519Keypair.fromSecretKey(raw.slice(1));
      }
      // Format hex 64 char (32 bytes)
      if (/^[0-9a-fA-F]{64}$/.test(key)) {
        return Ed25519Keypair.fromSecretKey(Buffer.from(key, 'hex'));
      }
      // Format base64
      const raw = fromB64(key);
      return Ed25519Keypair.fromSecretKey(raw.length === 33 ? raw.slice(1) : raw);
    } catch (e) {
      throw new BadRequestException(
        'Format private key tidak valid. Gunakan format suiprivkey1q... atau hex 64 karakter',
      );
    }
  }

  private encryptPrivateKey(privateKeyHex: string): { encrypted: string; iv: string } {
    const iv = crypto.randomBytes(12); // 96-bit IV untuk GCM
    const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    const encrypted = Buffer.concat([
      cipher.update(privateKeyHex, 'utf8'),
      cipher.final(),
      cipher.getAuthTag(), // 16 bytes auth tag di akhir
    ]);
    return {
      encrypted: encrypted.toString('base64'),
      iv: iv.toString('hex'),
    };
  }

  private decryptPrivateKey(encryptedBase64: string, ivHex: string): string {
    const iv = Buffer.from(ivHex, 'hex');
    const encryptedBuf = Buffer.from(encryptedBase64, 'base64');

    // Auth tag = 16 bytes terakhir
    const authTag = encryptedBuf.slice(-16);
    const ciphertext = encryptedBuf.slice(0, -16);

    const decipher = crypto.createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
    decipher.setAuthTag(authTag);

    return decipher.update(ciphertext) + decipher.final('utf8');
  }

  private generateInviteCode(): string {
    // 8 karakter uppercase alphanumeric
    return crypto.randomBytes(6).toString('base64url').toUpperCase().slice(0, 8);
  }
}