import { IsString, IsNotEmpty, IsOptional, IsEmail, IsIn } from 'class-validator';
 
export class CreateHospitalDto {
  @IsString()
  @IsNotEmpty()
  hospitalCode: string; // e.g. "RSUD-BEKASI"
 
  @IsString()
  @IsNotEmpty()
  name: string;
 
  @IsOptional()
  @IsString()
  address?: string;
 
  @IsOptional()
  @IsString()
  phone?: string;
 
  @IsOptional()
  @IsEmail()
  email?: string;
 
  // Wallet: generate baru atau import
  @IsIn(['generate', 'import'])
  walletMode: 'generate' | 'import';
 
  // Wajib diisi kalau walletMode = 'import'
  @IsOptional()
  @IsString()
  walletPrivateKey?: string; // format: suiprivkey1q... atau hex 64 char
}