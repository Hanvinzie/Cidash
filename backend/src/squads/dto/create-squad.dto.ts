import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ActivityType } from '@prisma/client';

export class CreateSquadDto {
  @IsString({ message: 'Nama circle harus berupa teks' })
  @IsNotEmpty({ message: 'Nama circle tidak boleh kosong' })
  @MinLength(3, { message: 'Nama circle minimal 3 karakter' })
  @MaxLength(50, { message: 'Nama circle maksimal 50 karakter' })
  name: string;

  @IsOptional()
  @IsEnum(ActivityType, {
    message: 'Tipe aktivitas circle harus RUNNING atau CYCLING',
  })
  activityType?: ActivityType;

  @IsOptional()
  @IsBoolean({ message: 'isPremium harus berupa boolean' })
  isPremium?: boolean;
}
