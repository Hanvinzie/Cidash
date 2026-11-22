import { IsNotEmpty, IsUUID } from 'class-validator';

export class CreateGroupRunDto {
  @IsUUID(undefined, { message: 'circleId tidak valid' })
  @IsNotEmpty({ message: 'circleId tidak boleh kosong' })
  circleId: string;
}
