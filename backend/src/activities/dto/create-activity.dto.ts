import {
  IsEnum,
  IsISO8601,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsPositive,
  Min,
} from 'class-validator';
import { ActivityType } from '@prisma/client';

export class CreateActivityDto {
  @IsEnum(ActivityType, { message: 'type harus berupa RUNNING atau CYCLING' })
  type: ActivityType;

  @IsNumber({}, { message: 'distanceMeters harus berupa angka dalam meter' })
  @IsPositive({ message: 'distanceMeters harus bernilai positif' })
  distanceMeters: number;

  @IsInt({ message: 'durationSeconds harus berupa bilangan bulat detik' })
  @Min(10, { message: 'Durasi minimal adalah 10 detik' })
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
