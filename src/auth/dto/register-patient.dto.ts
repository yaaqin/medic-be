import { IsString, IsNotEmpty, Length, IsOptional, IsEmail, Matches } from 'class-validator';

export class RegisterPatientDto {
  @IsString()
  @IsNotEmpty()
  @Length(16, 16, { message: 'NIK harus 16 digit' })
  @Matches(/^\d{16}$/, { message: 'NIK harus berupa 16 angka' })
  nik: string;

  @IsString()
  @IsNotEmpty()
  @Length(2, 100)
  namaIbuKandung: string;

  @IsString()
  @IsNotEmpty()
  @Length(2, 100)
  nama: string;

  @IsOptional()
  @IsString()
  @Matches(/^08[0-9]{8,11}$/, { message: 'Format nomor HP tidak valid' })
  noHp?: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}
