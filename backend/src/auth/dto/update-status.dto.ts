import { IsIn, IsNotEmpty, IsString } from 'class-validator';

export class UpdateStatusDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(['AVAILABLE', 'RESTING'], {
    message: 'status harus bernilai AVAILABLE atau RESTING',
  })
  status!: 'AVAILABLE' | 'RESTING';
}
