import { IsString, IsNotEmpty, IsOptional, IsIn, IsInt, Min, Max } from 'class-validator';
 
export class CreateInviteDto {
  @IsString()
  @IsNotEmpty()
  hospitalId: string;
 
  @IsOptional()
  @IsIn(['HOSPITAL_STAFF', 'VERIFIED_DOCTOR'])
  role?: 'HOSPITAL_STAFF' | 'VERIFIED_DOCTOR';
 
  // Berapa hari invite code valid (default 7)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(30)
  expiresInDays?: number;
}