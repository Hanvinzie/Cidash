import { Controller, Get, UseGuards } from '@nestjs/common';
import { RealtimeService } from './realtime.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RateLimit } from '../common/guards/rate-limit.guard';

@UseGuards(JwtAuthGuard)
@Controller('realtime')
export class RealtimeController {
  constructor(private readonly realtime: RealtimeService) {}

  /** Token Supabase Realtime berumur pendek untuk pengguna ini (lihat RealtimeService). */
  @RateLimit(20, 60_000)
  @Get('token')
  token(@CurrentUser('id') userId: string) {
    return this.realtime.issueToken(userId);
  }
}
