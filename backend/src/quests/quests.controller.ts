import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { QuestsService } from './quests.service';
import { CreateQuestDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RateLimit } from '../common/guards/rate-limit.guard';

@UseGuards(JwtAuthGuard)
@Controller('quests')
export class QuestsController {
  constructor(private readonly questsService: QuestsService) {}

  /**
   * Mengirimkan Bomb Mission P2P ke teman satu Circle.
   * Saldo koin pembuat diverifikasi dan dipotong secara otomatis.
   */
  @RateLimit(20, 60_000)
  @Post()
  async createQuest(
    @CurrentUser('id') creatorId: string,
    @Body() createQuestDto: CreateQuestDto,
  ) {
    return this.questsService.createQuest(creatorId, createQuestDto);
  }

  /**
   * Mengambil daftar seluruh misi aktif yang sedang berjalan di Circle pengguna.
   */
  @Get('active')
  async getActiveQuests(
    @CurrentUser('id') userId: string,
    @Query('squadId') squadId?: string,
  ) {
    return this.questsService.getActiveQuests(userId, squadId);
  }

  /**
   * Menggunakan Shield Ticket untuk membatalkan penalti dari misi aktif.
   */
  @RateLimit(15, 60_000)
  @HttpCode(HttpStatus.OK)
  @Post(':id/shield')
  async useShieldTicket(
    @Param('id') questId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.questsService.useShieldTicket(questId, userId);
  }

  /**
   * Menerima tantangan misi (mengubah status PENDING menjadi ACCEPTED).
   */
  @RateLimit(20, 60_000)
  @HttpCode(HttpStatus.OK)
  @Post(':id/accept')
  async acceptQuest(
    @Param('id') questId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.questsService.acceptQuest(questId, userId);
  }

  /**
   * Menolak tantangan misi (menggunakan Shield Ticket jika tersedia, atau menyerah/FAILED).
   */
  @RateLimit(20, 60_000)
  @HttpCode(HttpStatus.OK)
  @Post(':id/reject')
  async rejectQuest(
    @Param('id') questId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.questsService.rejectQuest(questId, userId);
  }

  /**
   * Membaca informasi detail dari suatu misi.
   */
  @Get(':id')
  async getQuestDetail(
    @Param('id') questId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.questsService.getQuestDetail(questId, userId);
  }

  /**
   * Endpoint pemicu manual untuk mengecek dan memproses misi yang kedaluwarsa.
   */
  @RateLimit(3, 60_000)
  @HttpCode(HttpStatus.OK)
  @Post('cron/expire-check')
  async triggerExpireCheck(@Headers('x-cron-secret') cronSecret?: string) {
    const requiredSecret = process.env.CRON_SECRET?.trim();
    if (requiredSecret && cronSecret !== requiredSecret) {
      throw new ForbiddenException('Cron secret tidak valid');
    }
    return this.questsService.expireOverdueQuests();
  }
}
