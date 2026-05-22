import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from '../common/services/crypto.service';
import { SuiService } from '../common/services/sui.service';
import { RegisterPatientDto } from './dto/register-patient.dto';
import { LoginPatientDto } from './dto/login-patient.dto';
import { LoginHospitalDto } from './dto/login-hospital.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly crypto: CryptoService,
    private readonly sui: SuiService,
  ) { }

  // ─────────────────────────────────────────────────
  // PATIENT AUTH
  // ─────────────────────────────────────────────────

  async registerPatient(dto: RegisterPatientDto) {
    const nikHash = this.crypto.hashSha256(dto.nik);
    const ibuKandungHash = this.crypto.hashSha256(dto.namaIbuKandung);

    // Cek duplikasi
    const existing = await this.prisma.patient.findUnique({ where: { nikHash } });
    if (existing) {
      throw new ConflictException('NIK sudah terdaftar');
    }

    // Generate deterministic wallet
    const wallet = this.crypto.generateDeterministicWallet(dto.nik, dto.namaIbuKandung);

    // Generate patient code
    const count = await this.prisma.patient.count();
    const patientCode = `PAT-${String(count + 1).padStart(4, '0')}`;

    // Simpan ke database
    const patient = await this.prisma.patient.create({
      data: {
        patientCode,
        nikHash,
        ibuKandungHash,
        walletPubkey: wallet.publicKey,
        name: dto.nama,
        phone: dto.noHp,
        email: dto.email,
      },
    });

    // Register on blockchain (async, tidak block response)
    this.sui
      .registerPatientOnChain({
        patientCode,
        nikHash,
        ibuKandungHash,
        walletPubkey: wallet.publicKey,
        patientName: dto.nama,
      })
      .then((tx) => this.logger.log(`Patient ${patientCode} registered on chain: ${tx}`))
      .catch((e) => this.logger.error('Blockchain registration failed', e));

    this.logger.log(`Patient registered: ${patientCode}`);

    return {
      success: true,
      patientId: patient.id,
      patientCode,
      message: 'Pasien berhasil didaftarkan',
      data: {
        nama: dto.nama,
        patientCode,
        walletPubkey: wallet.publicKey,
      },
    };
  }

  async loginPatient(dto: LoginPatientDto) {
    const nikHash = this.crypto.hashSha256(dto.nik);

    const patient = await this.prisma.patient.findUnique({ where: { nikHash } });
    if (!patient) {
      throw new UnauthorizedException('NIK atau nama ibu kandung tidak cocok');
    }

    // Verify identity — regenerate wallet dan cek pubkey
    const isValid = this.crypto.verifyIdentity(
      dto.nik,
      dto.namaIbuKandung,
      patient.walletPubkey,
    );

    if (!isValid) {
      throw new UnauthorizedException('NIK atau nama ibu kandung tidak cocok');
    }

    const token = this.jwtService.sign(
      {
        sub: patient.id,
        patientCode: patient.patientCode,
        nikHash: patient.nikHash,
        role: 'PATIENT',
        expiresIn: this.config.get<string>('jwt.expiresIn') ?? '7d',
      },
      {
        secret: this.config.get<string>('jwt.secret'),
      },
    );

    return {
      success: true,
      patientId: patient.id,
      patientCode: patient.patientCode,
      token,
      message: 'Login berhasil',
    };
  }

  // ─────────────────────────────────────────────────
  // HOSPITAL STAFF AUTH
  // ─────────────────────────────────────────────────

  async loginHospital(dto: LoginHospitalDto) {
    const staff = await this.prisma.hospitalStaff.findUnique({
      where: { email: dto.email },
      include: { hospital: true },
    });

    if (!staff) {
      throw new UnauthorizedException('Email atau password salah');
    }

    const passwordMatch = await bcrypt.compare(dto.password, staff.passwordHash);
    if (!passwordMatch) {
      throw new UnauthorizedException('Email atau password salah');
    }

    if (!staff.hospital.isActive) {
      throw new UnauthorizedException('Akun rumah sakit tidak aktif');
    }

    const token = this.jwtService.sign(
      {
        sub: staff.id,
        staffCode: staff.staffCode,
        hospitalId: staff.hospitalId,
        role: staff.role,
        expiresIn: this.config.get<string>('jwt.expiresIn') ?? '7d',
      },
      {
        secret: this.config.get<string>('jwt.secret'),
      }
    );

    return {
      success: true,
      staffId: staff.id,
      staffCode: staff.staffCode,
      name: staff.name,
      role: staff.role,
      hospitalCode: staff.hospital.hospitalCode,
      hospitalName: staff.hospital.name,
      isVerifiedDoctor: staff.isVerifiedDoctor,
      token,
      message: 'Login berhasil',
    };
  }
}
