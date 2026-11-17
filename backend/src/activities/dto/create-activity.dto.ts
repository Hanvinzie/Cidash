import {
  IsEnum,
  IsISO8601,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ActivityType } from '@prisma/client';

export class CreateActivityDto {
  /**
   * ID sesi yang dibuat client saat mulai merekam (UUID v4). Bila ada, baris draft yang
   * sudah di-update oleh batch sync diselesaikan, bukan membuat baris baru.
   */
  @IsOptional()
  @IsUUID('4', { message: 'id harus berupa UUID v4' })
  id?: string;

  @IsEnum(ActivityType, { message: 'type harus berupa RUNNING atau CYCLING' })
  type: ActivityType;

  @IsNumber({}, { message: 'distanceMeters harus berupa angka dalam meter' })
  @IsPositive({ message: 'distanceMeters harus bernilai positif' })
  @Min(50, { message: 'Jarak minimal aktivitas adalah 50 meter' })
  @Max(200000, { message: 'Jarak maksimal aktivitas adalah 200 km' })
  distanceMeters: number;

  @IsInt({ message: 'durationSeconds harus berupa bilangan bulat detik' })
  @Min(10, { message: 'Durasi minimal adalah 10 detik' })
  @Max(86400, { message: 'Durasi maksimal adalah 24 jam' })
  durationSeconds: number;

  @IsNumber({}, { message: 'averagePace harus berupa angka menit per kilometer' })
  @IsPositive({ message: 'averagePace harus bernilai positif' })
  averagePace: number;

  /** Rute lengkap sebagai Google Encoded Polyline (presisi 5). Wajib kecuali memakai routeGeoJson lama. */
  @IsOptional()
  @IsString({ message: 'encodedPolyline harus berupa string' })
  @MaxLength(100_000, { message: 'encodedPolyline terlalu panjang' })
  encodedPolyline?: string;

  /** @deprecated Format lama, tetap diterima agar client lama tidak rusak. Gunakan encodedPolyline. */
  @IsOptional()
  @IsObject({ message: 'routeGeoJson harus berupa objek GeoJSON yang valid' })
  routeGeoJson?: Record<string, any>;

  @IsOptional()
  @IsNumber({}, { message: 'elevationGain harus berupa angka dalam meter' })
  @Min(0)
  @Max(20000)
  elevationGain?: number;

  /** Label lokasi hasil reverse geocoding (sekali saat Finish). */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  locationLabel?: string;

  @IsISO8601({}, { message: 'startedAt harus berupa format ISO 8601 date string' })
  startedAt: string;

  @IsISO8601({}, { message: 'endedAt harus berupa format ISO 8601 date string' })
  endedAt: string;
}
