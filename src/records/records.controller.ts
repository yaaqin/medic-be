import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { RecordsService } from './records.service';
import { CreateRecordDto } from './dto/create-record.dto';
import { QueryRecordsDto, LogAccessDto } from './dto/query-records.dto';
import { JwtHospitalGuard } from '@/common/guards/jwt-auth.guard';

/**
 * Records module — semua endpoint butuh autentikasi staff/dokter hospital.
 *
 * req.user dari JWT payload:
 * {
 *   sub:        staffId (UUID di DB)
 *   hospitalId: hospitalId (UUID di DB)
 *   role:       'HOSPITAL_STAFF' | 'DOCTOR' | ...
 * }
 */
@Controller('records')
@UseGuards(JwtHospitalGuard)
export class RecordsController {
  constructor(private readonly recordsService: RecordsService) {}

  /**
   * POST /records
   * Buat rekam medis baru.
   * Body: CreateRecordDto
   * Auth: staff/dokter hospital manapun yang sudah login
   */
@Post()
async createRecord(@Body() dto: CreateRecordDto, @Request() req: any) {
  console.log('req.user:', req.user);
  console.log('dto:', dto);
  return this.recordsService.createRecord(dto, req.user.id, req.user.hospitalId);
}

  /**
   * GET /records/patient/:nikHash
   * List semua record milik pasien (by NIK hash).
   * Query: ?page=1&limit=20&recordType=LAB_RESULT
   */
  @Get('patient/:nikHash')
  async getPatientRecords(
    @Param('nikHash') nikHash: string,
    @Query() query: QueryRecordsDto,
    @Request() req: any,
  ) {
    return this.recordsService.getPatientRecords(nikHash, query, req.user.hospitalId);
  }

  /**
   * GET /records/:recordId
   * Detail satu rekam medis + link IPFS untuk dekripsi di client.
   */
  @Get(':recordId')
  async getRecord(@Param('recordId') recordId: string, @Request() req: any) {
    return this.recordsService.getRecordById(recordId, req.user.hospitalId);
  }

  /**
   * POST /records/:recordId/access-log
   * Manual log akses — dipakai kalau ada pihak ketiga yang akses.
   * Body: { purpose?: string }
   */
  @Post(':recordId/access-log')
  async logAccess(
    @Param('recordId') recordId: string,
    @Body() dto: LogAccessDto,
    @Request() req: any,
  ) {
    return this.recordsService.logAccess(
      recordId,
      dto.purpose ?? 'Manual access log',
      req.user.hospitalId,
    );
  }
}