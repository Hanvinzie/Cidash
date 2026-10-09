import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ActivitiesService } from './activities.service';
import { CreateActivityDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('activities')
export class ActivitiesController {
  constructor(private readonly activitiesService: ActivitiesService) {}

  /**
   * Menyimpan log aktivitas olahraga baru hasil perekaman sensor GPS.
   * Melakukan verifikasi anti-cheat, mencocokkan quest aktif, dan mengalokasikan poin.
   */
  @Post()
  async createActivity(
    @CurrentUser('id') userId: string,
    @Body() createActivityDto: CreateActivityDto,
  ) {
    return this.activitiesService.createActivity(userId, createActivityDto);
  }

  /**
   * Mengambil riwayat aktivitas olahraga pengguna sebelumnya dengan metrik agregasi dan paginasi.
   */
  @Get('history')
  async getHistory(
    @CurrentUser('id') userId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.activitiesService.getHistory(userId, page, limit);
  }

  /**
   * Mengambil rincian spesifik dari satu aktivitas olahraga (termasuk rute peta GeoJSON).
   */
  @Get(':id')
  async getActivityDetail(
    @Param('id') activityId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.activitiesService.getActivityDetail(activityId, userId);
  }
}
