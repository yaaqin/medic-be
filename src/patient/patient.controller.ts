import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { PatientService } from './patient.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('patient')
@UseGuards(JwtAuthGuard)
export class PatientController {
  constructor(private readonly patientService: PatientService) {}

  /**
   * GET /api/patient/:patientId
   * Get patient info — hanya pasien sendiri yang boleh akses
   */
  @Get(':patientId')
  async getPatient(
    @Param('patientId') patientId: string,
    @CurrentUser() user: any,
  ) {
    // Pasien hanya bisa lihat data sendiri
    if (user.id !== patientId) {
      return { success: false, message: 'Akses ditolak' };
    }
    return this.patientService.getPatientById(patientId);
  }

  /**
   * GET /api/patient/:patientId/wallet
   * Get patient wallet info
   */
  @Get(':patientId/wallet')
  async getWallet(
    @Param('patientId') patientId: string,
    @CurrentUser() user: any,
  ) {
    if (user.id !== patientId) {
      return { success: false, message: 'Akses ditolak' };
    }
    return this.patientService.getPatientWallet(patientId);
  }

  /**
   * GET /api/patient/:patientId/records
   * Get semua records pasien dari blockchain
   */
  @Get(':patientId/records')
  async getRecords(
    @Param('patientId') patientId: string,
    @CurrentUser() user: any,
  ) {
    if (user.id !== patientId) {
      return { success: false, message: 'Akses ditolak' };
    }
    return this.patientService.getPatientRecords(patientId);
  }

  /**
   * GET /api/patient/:patientId/emergency/logs
   * Pasien lihat siapa saja yang pernah EBG ke datanya
   */
  @Get(':patientId/emergency/logs')
  async getEbgLogs(
    @Param('patientId') patientId: string,
    @CurrentUser() user: any,
  ) {
    if (user.id !== patientId) {
      return { success: false, message: 'Akses ditolak' };
    }
    return this.patientService.getPatientEbgLogs(patientId);
  }
}
