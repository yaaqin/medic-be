import { IsString, IsNotEmpty, IsEmail, MinLength } from 'class-validator';

export class LoginHospitalDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password: string;
}
