import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  MinLength,
} from 'class-validator';

export enum RecordType {
  CONSULTATION = 'CONSULTATION',
  LAB_RESULT = 'LAB_RESULT',
  PRESCRIPTION = 'PRESCRIPTION',
  RADIOLOGY = 'RADIOLOGY',
  SURGERY = 'SURGERY',
  VACCINATION = 'VACCINATION',
  OTHER = 'OTHER',
}

export class CreateRecordDto {
  @IsString()
  @IsNotEmpty()
  patientNikHash: string; // SHA256(NIK) pasien

  @IsString()
  @IsNotEmpty()
  doctorId: string; // doctor_id on-chain

  @IsEnum(RecordType)
  recordType: RecordType;

  /**
   * Data rekam medis dalam bentuk JSON string atau teks.
   * Akan dienkripsi dan di-upload ke IPFS oleh service.
   * TIDAK disimpan di DB — hanya hash-nya.
   */
  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  medicalData: string;

  @IsString()
  @IsOptional()
  notes?: string;
}