import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @IsEmail({}, { message: 'Format email tidak valid' })
  @IsNotEmpty({ message: 'Email tidak boleh kosong' })
  @MaxLength(100, { message: 'Email maksimal 100 karakter' })
  email: string;

  @IsString({ message: 'Password harus berupa string' })
  @MinLength(6, { message: 'Password minimal 6 karakter' })
  @MaxLength(128, { message: 'Password maksimal 128 karakter' })
  password: string;

  @IsString({ message: 'Nama harus berupa string' })
  @IsNotEmpty({ message: 'Nama tidak boleh kosong' })
  @MinLength(2, { message: 'Nama minimal 2 karakter' })
  @MaxLength(60, { message: 'Nama maksimal 60 karakter' })
  name: string;
}
