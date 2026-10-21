import {
  IsEnum,
  IsISO8601,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsPositive,
  Max,
  Min,
} from 'class-validator';
import { ActivityType } from '@prisma/client';

export class CreateActivityDto {
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

  @IsNotEmpty({ message: 'routeGeoJson tidak boleh kosong' })
  routeGeoJson: any;

  @IsISO8601({}, { message: 'startedAt harus berupa format ISO 8601 date string' })
  startedAt: string;

  @IsISO8601({}, { message: 'endedAt harus berupa format ISO 8601 date string' })
  endedAt: string;
}
