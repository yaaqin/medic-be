import { IsString, IsNotEmpty, Length, Matches } from 'class-validator';

export class LoginPatientDto {
  @IsString()
  @IsNotEmpty()
  @Length(16, 16, { message: 'NIK harus 16 digit' })
  @Matches(/^\d{16}$/, { message: 'NIK harus berupa 16 angka' })
  nik: string;

  @IsString()
  @IsNotEmpty()
  @Length(2, 100)
  namaIbuKandung: string;
}
