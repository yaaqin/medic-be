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
