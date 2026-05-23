// src/hospital/hospital.controller.ts

import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { HospitalService } from './hospital.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CreateHospitalDto } from './dto/create-hospital.dto';
import { CreateInviteDto } from './dto/create-invite.dto';

@Controller('api/admin/hospitals')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class HospitalController {
  constructor(private readonly hospitalService: HospitalService) {}

  // POST /api/admin/hospitals
  // Admin daftarkan hospital baru
  @Post()
  async createHospital(@Body() dto: CreateHospitalDto, @Request() req: any) {
    return this.hospitalService.createHospital(dto, req.user.sub);
  }

  // GET /api/admin/hospitals
  // List semua hospital
  @Get()
  async listHospitals(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.hospitalService.listHospitals(page, limit);
  }

  // GET /api/admin/hospitals/:id
  // Detail hospital + list staff
  @Get(':id')
  async getHospital(@Param('id') id: string) {
    return this.hospitalService.getHospitalById(id);
  }

  // PATCH /api/admin/hospitals/:id/toggle
  // Aktifkan / nonaktifkan hospital
  @Patch(':id/toggle')
  async toggleActive(@Param('id') id: string, @Body('isActive') isActive: boolean) {
    return this.hospitalService.toggleHospitalActive(id, isActive);
  }

  // POST /api/admin/hospitals/invite
  // Generate invite code untuk hospital
  @Post('invite')
  async createInvite(@Body() dto: CreateInviteDto) {
    return this.hospitalService.createInviteCode(dto);
  }

  // GET /api/admin/hospitals/:id/invites
  // List semua invite code milik hospital
  @Get(':id/invites')
  async listInvites(@Param('id') hospitalId: string) {
    return this.hospitalService.listInviteCodes(hospitalId);
  }
}