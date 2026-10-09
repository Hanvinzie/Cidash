import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateSquadDto {
  @IsString({ message: 'Nama circle harus berupa teks' })
  @IsNotEmpty({ message: 'Nama circle tidak boleh kosong' })
  @MinLength(3, { message: 'Nama circle minimal 3 karakter' })
  @MaxLength(50, { message: 'Nama circle maksimal 50 karakter' })
  name: string;

  @IsOptional()
  @IsBoolean({ message: 'isPremium harus berupa boolean' })
  isPremium?: boolean;
}
