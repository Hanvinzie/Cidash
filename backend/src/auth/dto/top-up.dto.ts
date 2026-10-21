import { IsInt, Max, Min } from 'class-validator';

export class TopUpDto {
  @IsInt({ message: 'Jumlah koin top-up harus berupa bilangan bulat' })
  @Min(1, { message: 'Jumlah koin top-up minimal 1' })
  @Max(10000, { message: 'Jumlah koin top-up maksimal 10.000 per transaksi' })
  coins: number;
}
