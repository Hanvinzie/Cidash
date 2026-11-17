import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ActivitiesService } from './activities.service';
import { CreateActivityDto, SyncActivityBatchDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RateLimit } from '../common/guards/rate-limit.guard';

@UseGuards(JwtAuthGuard)
@Controller('activities')
export class ActivitiesController {
  constructor(private readonly activitiesService: ActivitiesService) {}

  /**
   * Menyimpan log aktivitas olahraga baru hasil perekaman sensor GPS.
   * Melakukan verifikasi anti-cheat, mencocokkan quest aktif, dan mengalokasikan poin.
   */
  @RateLimit(15, 60_000)
  @Post()
  async createActivity(
    @CurrentUser('id') userId: string,
    @Body() createActivityDto: CreateActivityDto,
  ) {
    return this.activitiesService.createActivity(userId, createActivityDto);
  }

  /**
   * Batch sync GPS saat merekam (±15 titik / 30 detik, dan saat Pause).
   * `:id` = UUID v4 sesi buatan client. Batch pertama membuat baris draft, batch berikutnya
   * meng-update baris yang sama (1 baris per aktivitas). Idempoten, aman di-retry.
   */
  @RateLimit(30, 60_000)
  @Put('sessions/:id/sync')
  async syncBatch(
    @CurrentUser('id') userId: string,
    @Param('id', new ParseUUIDPipe({ version: '4' })) activityId: string,
    @Body() dto: SyncActivityBatchDto,
  ) {
    return this.activitiesService.syncBatch(userId, activityId, dto);
  }

  /** Membuang draft sesi yang di-discard user (hanya yang belum selesai). */
  @RateLimit(30, 60_000)
  @Delete('sessions/:id')
  async discardDraft(
    @CurrentUser('id') userId: string,
    @Param('id', new ParseUUIDPipe({ version: '4' })) activityId: string,
  ) {
    return this.activitiesService.discardDraft(userId, activityId);
  }

  /**
   * Mengambil riwayat aktivitas olahraga pengguna sebelumnya dengan metrik agregasi dan paginasi (mendukung cursor, page, dan opsi includeRoute).
   */
  @RateLimit(60, 60_000)
  @Get('history')
  async getHistory(
    @CurrentUser('id') userId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('cursor') cursor?: string,
    @Query('includeRoute') includeRoute?: string,
  ) {
    const shouldIncludeRoute =
      includeRoute === undefined
        ? true
        : includeRoute !== 'false' && includeRoute !== '0';
    return this.activitiesService.getHistory(
      userId,
      page,
      limit,
      cursor,
      shouldIncludeRoute,
    );
  }

  /**
   * Mengambil rincian spesifik dari satu aktivitas olahraga (termasuk rute peta sebagai encoded polyline).
   */
  @RateLimit(60, 60_000)
  @Get(':id')
  async getActivityDetail(
    @Param('id', new ParseUUIDPipe({ version: '4' })) activityId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.activitiesService.getActivityDetail(activityId, userId);
  }
}
