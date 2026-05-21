import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SuiService } from '../common/services/sui.service';
import { CryptoService } from '../common/services/crypto.service';

@Injectable()
export class PatientService {
  private readonly logger = new Logger(PatientService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sui: SuiService,
    private readonly crypto: CryptoService,
  ) {}

  async getPatientById(patientId: string) {
    const patient = await this.prisma.patient.findUnique({
      where: { id: patientId },
      select: {
        id: true,
        patientCode: true,
        name: true,
        phone: true,
        email: true,
        walletPubkey: true,
        createdAt: true,
        // nikHash & ibuKandungHash TIDAK di-return ke client
      },
    });

    if (!patient) throw new NotFoundException('Pasien tidak ditemukan');

    return { success: true, data: patient };
  }

  async getPatientWallet(patientId: string) {
    const patient = await this.prisma.patient.findUnique({
      where: { id: patientId },
      select: { walletPubkey: true, patientCode: true },
    });

    if (!patient) throw new NotFoundException('Pasien tidak ditemukan');

    return {
      success: true,
      data: {
        patientCode: patient.patientCode,
        walletPubkey: patient.walletPubkey,
        // address: derived dari pubkey
        address: '0x' + patient.walletPubkey.slice(0, 40),
      },
    };
  }

  async getPatientRecords(patientId: string) {
    // Get patient nikHash untuk query blockchain
    const patient = await this.prisma.patient.findUnique({
      where: { id: patientId },
      select: { nikHash: true, patientCode: true },
    });

    if (!patient) throw new NotFoundException('Pasien tidak ditemukan');

    // Query blockchain untuk semua records
    const chainRecords = await this.sui.getPatientRecords(patient.nikHash);

    return {
      success: true,
      patientCode: patient.patientCode,
      records: chainRecords,
      total: chainRecords.length,
    };
  }

  async getPatientEbgLogs(patientId: string) {
    const patient = await this.prisma.patient.findUnique({ where: { id: patientId } });
    if (!patient) throw new NotFoundException('Pasien tidak ditemukan');

    const logs = await this.prisma.emergencyAccessLog.findMany({
      where: { patientId },
      select: {
        ebgCode: true,
        emergencyType: true,
        status: true,
        location: true,
        witnessedBy: true,
        createdAt: true,
        completedAt: true,
        blockchainTxInitiated: true,
        doctor: {
          select: {
            staffCode: true,
            name: true,
            specialization: true,
            hospital: { select: { hospitalCode: true, name: true } },
          },
        },
        // justification TIDAK di-return ke pasien (untuk proteksi privasi dokter)
        // pasien hanya tahu SIAPA yang akses, KAPAN, dan TIPE DARURAT
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      success: true,
      data: logs,
      total: logs.length,
    };
  }
}
