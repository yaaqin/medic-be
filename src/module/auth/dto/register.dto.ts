import { IsString, IsEmail, Length, IsNotEmpty, Matches } from 'class-validator';

export class RegisterDto {
  @IsString({ message: 'NIK harus berupa string' })
  @Length(16, 16, { message: 'NIK harus tepat 16 digit' })
  @Matches(/^\d+$/, { message: 'NIK hanya boleh berisi angka' })
  nik: string;

  @IsString({ message: 'Nama ibu kandung harus berupa string' })
  @IsNotEmpty({ message: 'Nama ibu kandung tidak boleh kosong' })
  @Length(3, 100, { message: 'Nama ibu kandung harus 3-100 karakter' })
  namaIbuKandung: string;

  @IsString({ message: 'Nama harus berupa string' })
  @IsNotEmpty({ message: 'Nama tidak boleh kosong' })
  @Length(3, 100, { message: 'Nama harus 3-100 karakter' })
  nama: string;

  @IsString({ message: 'No HP harus berupa string' })
  @IsNotEmpty({ message: 'No HP tidak boleh kosong' })
  @Matches(/^(\+62|0)[0-9]{9,12}$/, {
    message: 'No HP harus format Indonesia (08xxx atau +628xxx)',
  })
  noHp: string;

  @IsEmail({}, { message: 'Email harus format email yang valid' })
  email: string;
}

export class LoginDto {
  @IsString({ message: 'NIK harus berupa string' })
  @Length(16, 16, { message: 'NIK harus tepat 16 digit' })
  @Matches(/^\d+$/, { message: 'NIK hanya boleh berisi angka' })
  nik: string;

  @IsString({ message: 'Nama ibu kandung harus berupa string' })
  @IsNotEmpty({ message: 'Nama ibu kandung tidak boleh kosong' })
  namaIbuKandung: string;
}

export class VerifyPatientDto {
  @IsString({ message: 'NIK hash harus berupa string' })
  @IsNotEmpty({ message: 'NIK hash tidak boleh kosong' })
  nikHash: string;

  @IsString({ message: 'Ibu kandung hash harus berupa string' })
  @IsNotEmpty({ message: 'Ibu kandung hash tidak boleh kosong' })
  ibuKandungHash: string;
}