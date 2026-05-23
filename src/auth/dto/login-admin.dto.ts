import { IsString, IsNotEmpty } from 'class-validator';
 
export class LoginAdminDto {
  @IsString()
  @IsNotEmpty()
  privateKey: string; 
}