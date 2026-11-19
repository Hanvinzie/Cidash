import {
  IsEnum,
  IsISO8601,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ActivityType } from '@prisma/client';

/**
 * Satu batch titik GPS (±15 titik / 30 detik) untuk sesi yang sedang direkam.
 * `polyline` hanya berisi titik BARU (delta) mulai indeks `fromIndex`; server menambahkannya
 * ke polyline tersimpan, sehingga pengiriman ulang setelah gagal bersifat idempoten.
 */
export class SyncActivityBatchDto {
  @IsEnum(ActivityType, { message: 'type harus berupa RUNNING atau CYCLING' })
  type: ActivityType;

  @IsISO8601({}, { message: 'startedAt harus berupa format ISO 8601 date string' })
  startedAt: string;

  /** Jumlah titik yang menurut client sudah diterima server sebelum batch ini. */
  @IsInt()
  @Min(0)
  @Max(10_000)
  fromIndex: number;

  @IsString()
  @MaxLength(20_000, { message: 'Batch polyline terlalu besar' })
  polyline: string;

  @IsNumber()
  @Min(0)
  @Max(200_000)
  distanceMeters: number;

  @IsInt()
  @Min(0)
  @Max(86_400)
  durationSeconds: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(20_000)
  elevationGain?: number;
}
