// src/hospital/hospital.controller.ts
// Update: ganti JwtAuthGuard + RolesGuard → JwtAdminGuard

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
import { CreateHospitalDto } from './dto/create-hospital.dto';
import { CreateInviteDto } from './dto/create-invite.dto';
import { JwtAdminGuard } from '@/common/guards/jwt-admin.guard';

@Controller('admin/hospitals')
@UseGuards(JwtAdminGuard)
export class HospitalController {
  constructor(private readonly hospitalService: HospitalService) {}

  @Post()
  async createHospital(@Body() dto: CreateHospitalDto, @Request() req: any) {
    return this.hospitalService.createHospital(dto, req.user.sub);
  }

  @Get()
  async listHospitals(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.hospitalService.listHospitals(page, limit);
  }

  @Get(':id')
  async getHospital(@Param('id') id: string) {
    return this.hospitalService.getHospitalById(id);
  }

  @Patch(':id/toggle')
  async toggleActive(@Param('id') id: string, @Body('isActive') isActive: boolean) {
    return this.hospitalService.toggleHospitalActive(id, isActive);
  }

  @Post('invite')
  async createInvite(@Body() dto: CreateInviteDto) {
    return this.hospitalService.createInviteCode(dto);
  }

  @Get(':id/invites')
  async listInvites(@Param('id') hospitalId: string) {
    return this.hospitalService.listInviteCodes(hospitalId);
  }
}