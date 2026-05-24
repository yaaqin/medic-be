import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  Logger,
  BadRequestException,
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
import { LoginAdminDto } from './dto/login-admin.dto';
import { RegisterStaffDto } from './dto/register-staff.dto';

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
        secret: this.config.get<string>('jwt.hospitalSecret'), // ← ganti ini
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

  async loginAdmin(dto: LoginAdminDto) {
    // Derive address dari private key yang diinput
    let inputAddress: string;

    this.logger.log(`Input key prefix: ${dto.privateKey.substring(0, 20)}...`);
    this.logger.log(`Input address:    ${inputAddress}`);
    try {
      const keypair = this.sui.parseKeypair(dto.privateKey);
      inputAddress = keypair.getPublicKey().toSuiAddress();
    } catch (e) {
      this.logger.error(`parseKeypair error: ${(e as Error).message}`);
      throw new UnauthorizedException('Private key tidak valid');
    }

    // Bandingkan dengan deployer address — derive dari SUI_ADMIN_PRIVATE_KEY di .env
    const adminPrivKey = this.config.get<string>('sui.adminPrivateKey') ?? '';
    if (!adminPrivKey) {
      throw new UnauthorizedException('Admin belum dikonfigurasi di server');
    }

    let adminAddress: string;
    this.logger.log(`Admin address:    ${adminAddress}`);
    this.logger.log(`Match:            ${inputAddress === adminAddress}`);
    try {
      const adminKeypair = this.sui.parseKeypair(adminPrivKey);
      adminAddress = adminKeypair.getPublicKey().toSuiAddress();
    } catch (e) {
      throw new UnauthorizedException('Konfigurasi admin server error');
    }

    if (inputAddress !== adminAddress) {
      throw new UnauthorizedException('Private key tidak cocok');
    }

    const token = this.jwtService.sign(
      {
        sub: adminAddress,
        address: adminAddress,
        role: 'ADMIN',
        expiresIn: this.config.get<string>('jwt.adminExpiresIn') ?? '8h',
      },
      {
        secret: this.config.get<string>('jwt.adminSecret'),
      },
    );

    this.logger.log(`Admin login: ${adminAddress}`);

    return {
      success: true,
      address: adminAddress,
      token,
      message: 'Login admin berhasil',
    };
  }


  async registerStaff(dto: RegisterStaffDto) {
    // 1. Validasi invite code
    const invite = await this.prisma.hospitalInviteCode.findUnique({
      where: { code: dto.inviteCode },
      include: { hospital: true },
    });

    if (!invite) throw new BadRequestException('Invite code tidak valid');
    if (invite.usedById) throw new ConflictException('Invite code sudah digunakan');
    if (new Date() > invite.expiresAt) throw new BadRequestException('Invite code sudah expired');
    if (!invite.hospital.isActive) throw new BadRequestException('Hospital tidak aktif');

    // 2. Cek email belum terdaftar
    const existingEmail = await this.prisma.hospitalStaff.findUnique({
      where: { email: dto.email },
    });
    if (existingEmail) throw new ConflictException('Email sudah terdaftar');

    // 3. Generate staff code
    const prefix = invite.role === 'VERIFIED_DOCTOR' ? 'DOC' : 'STF';
    const count = await this.prisma.hospitalStaff.count();
    const staffCode = `${prefix}-${String(count + 1).padStart(4, '0')}`;

    // 4. Hash password
    const passwordHash = await bcrypt.hash(dto.password, 12);

    // 5. Hash NIK dokter kalau ada
    let nikHash: string | undefined;
    if (dto.nik) {
      nikHash = this.crypto.hashSha256(dto.nik);
    }

    // 6. Simpan staff
    const staff = await this.prisma.hospitalStaff.create({
      data: {
        staffCode,
        name: dto.name,
        email: dto.email,
        passwordHash,
        role: invite.role,
        hospitalId: invite.hospitalId,
        nikHash,
        strNumber: dto.strNumber,
        sipNumber: dto.sipNumber,
        specialization: dto.specialization,
        isVerifiedDoctor: invite.role === 'VERIFIED_DOCTOR',
        verifiedAt: invite.role === 'VERIFIED_DOCTOR' ? new Date() : undefined,
        inviteCodeUsed: dto.inviteCode,
      },
    });

    // 7. Mark invite code sebagai sudah dipakai
    await this.prisma.hospitalInviteCode.update({
      where: { code: dto.inviteCode },
      data: { usedById: staff.id, usedAt: new Date() },
    });

    // 8. Kalau VERIFIED_DOCTOR, register on-chain juga
    if (invite.role === 'VERIFIED_DOCTOR' && dto.strNumber && dto.sipNumber) {
      this.sui
        .verifyDoctorOnChain({
          doctorId: staffCode,
          nikHash: nikHash ?? '',
          strNumber: dto.strNumber,
          sipNumber: dto.sipNumber,
          hospitalId: invite.hospital.hospitalCode,
          specialization: dto.specialization ?? 'General',
        })
        .then((tx) => this.logger.log(`Doctor ${staffCode} verified on chain: ${tx}`))
        .catch((e) => this.logger.error('Doctor on-chain verification failed', e));
    }

    this.logger.log(`Staff registered: ${staffCode} @ ${invite.hospital.hospitalCode}`);

    return {
      success: true,
      staffCode,
      name: staff.name,
      role: staff.role,
      hospitalCode: invite.hospital.hospitalCode,
      hospitalName: invite.hospital.name,
      isVerifiedDoctor: staff.isVerifiedDoctor,
      message: 'Registrasi berhasil',
    };
  }

}
