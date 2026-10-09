import {
  Body,
  Controller,
  Get,
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

@UseGuards(JwtAuthGuard)
@Controller('quests')
export class QuestsController {
  constructor(private readonly questsService: QuestsService) {}

  /**
   * Mengirimkan Bomb Mission P2P ke teman satu Circle.
   * Saldo koin pembuat diverifikasi dan dipotong secara otomatis.
   */
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
  @HttpCode(HttpStatus.OK)
  @Post(':id/accept')
  async acceptQuest(
    @Param('id') questId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.questsService.acceptQuest(questId, userId);
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
  @HttpCode(HttpStatus.OK)
  @Post('cron/expire-check')
  async triggerExpireCheck() {
    return this.questsService.expireOverdueQuests();
  }
}
