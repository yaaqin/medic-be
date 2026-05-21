import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterPatientDto } from './dto/register-patient.dto';
import { LoginPatientDto } from './dto/login-patient.dto';
import { LoginHospitalDto } from './dto/login-hospital.dto';

@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * POST /api/patient/register
   * Register pasien baru dengan NIK + Nama Ibu Kandung
   */
  @Post('patient/register')
  async registerPatient(@Body() dto: RegisterPatientDto) {
    return this.authService.registerPatient(dto);
  }

  /**
   * POST /api/patient/login
   * Login pasien — returns JWT token
   */
  @Post('patient/login')
  @HttpCode(HttpStatus.OK)
  async loginPatient(@Body() dto: LoginPatientDto) {
    return this.authService.loginPatient(dto);
  }

  /**
   * POST /api/hospital/login
   * Login hospital staff / dokter — returns JWT token
   */
  @Post('hospital/login')
  @HttpCode(HttpStatus.OK)
  async loginHospital(@Body() dto: LoginHospitalDto) {
    return this.authService.loginHospital(dto);
  }
}
