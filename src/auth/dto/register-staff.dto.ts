// src/auth/dto/register-staff.dto.ts

import {
  IsString,
  IsNotEmpty,
  IsEmail,
  MinLength,
  IsOptional,
} from 'class-validator';

export class RegisterStaffDto {
  @IsString()
  @IsNotEmpty()
  inviteCode: string; // kode dari hospital admin

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  // Doctor-specific (opsional — diisi kalau invite role = VERIFIED_DOCTOR)
  @IsOptional()
  @IsString()
  nik?: string; // untuk generate nikHash dokter

  @IsOptional()
  @IsString()
  strNumber?: string;

  @IsOptional()
  @IsString()
  sipNumber?: string;

  @IsOptional()
  @IsString()
  specialization?: string;
}

// ─────────────────────────────────────────────────
// Tambahkan method ini ke auth.service.ts
// ─────────────────────────────────────────────────

/*
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
*/