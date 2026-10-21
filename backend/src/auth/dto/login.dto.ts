import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class LoginDto {
  @IsEmail({}, { message: 'Format email tidak valid' })
  @IsNotEmpty({ message: 'Email tidak boleh kosong' })
  @MaxLength(100, { message: 'Email maksimal 100 karakter' })
  email: string;

  @IsString({ message: 'Password harus berupa string' })
  @IsNotEmpty({ message: 'Password tidak boleh kosong' })
  @MaxLength(128, { message: 'Password maksimal 128 karakter' })
  password: string;
}
