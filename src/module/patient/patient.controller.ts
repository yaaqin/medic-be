// src/modules/patient/patient.controller.ts
import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  HttpCode,
  BadRequestException,
} from '@nestjs/common';
import { PatientService } from './patient.service';
import { RegisterDto, LoginDto } from '../auth/dto/register.dto';
import { CryptoService } from '../crypto/crypto.service';

@Controller('api/patient')
export class PatientController {
  constructor(
    private patientService: PatientService,
    private cryptoService: CryptoService,
  ) {}

  /**
   * Register patient
   * POST /api/patient/register
   */
  @Post('register')
  @HttpCode(201)
  async register(@Body() registerDto: RegisterDto) {
    try {
      const result = await this.patientService.registerPatient(
        registerDto.nik,
        registerDto.namaIbuKandung,
        registerDto.nama,
        registerDto.noHp,
        registerDto.email,
      );

      return result;
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  /**
   * Login patient
   * POST /api/patient/login
   */
  @Post('login')
  @HttpCode(200)
  async login(@Body() loginDto: LoginDto) {
    try {
      // Hash credentials
      const nikHash = this.cryptoService.hashValue(loginDto.nik);
      const ibuKandungHash = this.cryptoService.hashValue(
        loginDto.namaIbuKandung,
      );

      // Verify patient
      const result = await this.patientService.verifyPatient(
        nikHash,
        ibuKandungHash,
      );

      return result;
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  /**
   * Get patient info
   * GET /api/patient/:patientId
   */
  @Get(':patientId')
  async getPatientInfo(@Param('patientId') patientId: string) {
    const info = this.patientService.getPatientInfo(patientId);
    return {
      success: true,
      data: info,
    };
  }

  /**
   * Get patient wallet (internal use)
   * GET /api/patient/:patientId/wallet
   */
  @Get(':patientId/wallet')
  async getWallet(@Param('patientId') patientId: string) {
    const wallet = this.patientService.getPatientWallet(patientId);
    return {
      success: true,
      data: wallet,
    };
  }
}