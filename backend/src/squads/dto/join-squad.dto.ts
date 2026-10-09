import { IsNotEmpty, IsString, Length, Matches } from 'class-validator';

export class JoinSquadDto {
  @IsString({ message: 'Kode undangan harus berupa teks' })
  @IsNotEmpty({ message: 'Kode undangan tidak boleh kosong' })
  @Length(8, 8, { message: 'Kode circle harus tepat 8 karakter' })
  @Matches(/^[A-Z0-9]{8}$/i, {
    message: 'Kode circle harus berupa 8 karakter alfanumerik (huruf dan angka)',
  })
  inviteCode: string;
}
