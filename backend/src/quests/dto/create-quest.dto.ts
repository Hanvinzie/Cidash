import {
  IsEnum,
  IsISO8601,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ActivityType } from '@prisma/client';

export class CreateQuestDto {
  @IsUUID('4', { message: 'squadId harus berupa UUID yang valid' })
  @IsNotEmpty({ message: 'squadId tidak boleh kosong' })
  squadId: string;

  @IsUUID('4', { message: 'targetUserId harus berupa UUID yang valid' })
  @IsNotEmpty({ message: 'targetUserId tidak boleh kosong' })
  targetUserId: string;

  @IsEnum(ActivityType, { message: 'activityType harus RUNNING atau CYCLING' })
  activityType: ActivityType;

  @IsNumber({}, { message: 'targetDistance harus berupa angka dalam meter' })
  @IsPositive({ message: 'targetDistance harus bernilai positif' })
  targetDistance: number;

  @IsOptional()
  @IsNumber({}, { message: 'targetMaxPace harus berupa angka menit/km' })
  @IsPositive({ message: 'targetMaxPace harus bernilai positif' })
  targetMaxPace?: number;

  @IsInt({ message: 'stakesPoints harus berupa bilangan bulat' })
  @Min(5, { message: 'Taruhan minimal 5 poin' })
  @Max(500, { message: 'Taruhan maksimal 500 poin' })
  stakesPoints: number;

  @IsOptional()
  @IsString({ message: 'rewardTitle harus berupa teks' })
  @MaxLength(100, { message: 'rewardTitle maksimal 100 karakter' })
  rewardTitle?: string;

  @IsISO8601({}, { message: 'deadline harus berupa format ISO 8601 date string' })
  @IsNotEmpty({ message: 'deadline tidak boleh kosong' })
  deadline: string;
}
