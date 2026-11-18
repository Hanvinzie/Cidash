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
import { ActivityType, QuestDifficulty } from '@prisma/client';

export class CreateQuestDto {
  @IsUUID('4', { message: 'squadId harus berupa UUID yang valid' })
  @IsNotEmpty({ message: 'squadId tidak boleh kosong' })
  squadId: string;

  @IsUUID('4', { message: 'targetUserId harus berupa UUID yang valid' })
  @IsNotEmpty({ message: 'targetUserId tidak boleh kosong' })
  targetUserId: string;

  @IsEnum(ActivityType, { message: 'activityType harus RUNNING atau CYCLING' })
  activityType: ActivityType;

  /** Jarak target (meter). Harus salah satu pilihan resmi untuk jenis aktivitasnya (lihat quest-pricing.ts). */
  @IsNumber({}, { message: 'targetDistance harus berupa angka dalam meter' })
  @IsPositive({ message: 'targetDistance harus bernilai positif' })
  @Min(100, { message: 'targetDistance minimal 100 meter' })
  @Max(200000, { message: 'targetDistance maksimal 200 km' })
  targetDistance: number;

  /** Tingkat kesulitan: menentukan batas waktu (pace), biaya koin, dan taruhan RP. Dihitung ulang di server. */
  @IsEnum(QuestDifficulty, { message: 'difficulty harus EASY, MEDIUM, HARD, atau HELL' })
  difficulty: QuestDifficulty;

  /** @deprecated Diabaikan: pace dihitung server dari jarak dan kesulitan. */
  @IsOptional()
  @IsNumber({}, { message: 'targetMaxPace harus berupa angka menit/km' })
  targetMaxPace?: number;

  /** @deprecated Diabaikan: taruhan RP dihitung server dari biaya koin. */
  @IsOptional()
  @IsInt({ message: 'stakesPoints harus berupa bilangan bulat' })
  stakesPoints?: number;

  /** @deprecated Diabaikan: biaya koin dihitung server dari jarak, kesulitan, dan tenggat. */
  @IsOptional()
  @IsInt({ message: 'wagerCoins harus berupa bilangan bulat' })
  wagerCoins?: number;

  @IsOptional()
  @IsString({ message: 'rewardTitle harus berupa teks' })
  @MaxLength(100, { message: 'rewardTitle maksimal 100 karakter' })
  rewardTitle?: string;

  @IsISO8601({}, { message: 'deadline harus berupa format ISO 8601 date string' })
  @IsNotEmpty({ message: 'deadline tidak boleh kosong' })
  deadline: string;
}
