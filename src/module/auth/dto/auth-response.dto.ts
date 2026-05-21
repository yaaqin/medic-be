export class AuthResponseDto {
  success!: boolean;
  message!: string;
  token?: string;
  patientId?: string;
  data?: {
    nik?: string;
    nama?: string;
    walletPubkey?: string;
  };
}