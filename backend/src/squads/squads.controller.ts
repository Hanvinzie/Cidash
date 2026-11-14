import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { SquadsService } from './squads.service';
import { CreateSquadDto, JoinSquadDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RateLimit } from '../common/guards/rate-limit.guard';

@UseGuards(JwtAuthGuard)
@Controller('squads')
export class SquadsController {
  constructor(private readonly squadsService: SquadsService) {}

  /**
   * Membuat Circle baru dengan kode 8 karakter acak unik dan menetapkan pembuat sebagai CAPTAIN.
   */
  @RateLimit(10, 60_000)
  @Post()
  async createSquad(
    @CurrentUser('id') userId: string,
    @Body() createSquadDto: CreateSquadDto,
  ) {
    return this.squadsService.createSquad(userId, createSquadDto);
  }

  /**
   * Bergabung ke dalam Circle menggunakan kode undangan 8 karakter.
   */
  @RateLimit(10, 60_000)
  @HttpCode(HttpStatus.OK)
  @Post('join')
  async joinSquad(
    @CurrentUser('id') userId: string,
    @Body() joinSquadDto: JoinSquadDto,
  ) {
    return this.squadsService.joinSquad(userId, joinSquadDto);
  }

  /**
   * Mengambil daftar seluruh Circle yang diikuti oleh pengguna saat ini.
   */
  @RateLimit(60, 60_000)
  @Get('my')
  async getMySquads(@CurrentUser('id') userId: string) {
    return this.squadsService.getMySquads(userId);
  }

  /**
   * Meng-upgrade Circle dari Free (maks 5 anggota) ke Premium (maks 25 anggota) menggunakan 100 koin.
   */
  @RateLimit(10, 60_000)
  @HttpCode(HttpStatus.OK)
  @Post(':id/upgrade')
  async upgradeSquad(
    @Param('id', new ParseUUIDPipe({ version: '4' })) squadId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.squadsService.upgradeSquad(squadId, userId);
  }

  /**
   * Mengambil urutan peringkat anggota (Leaderboard) Circle berdasarkan rankPoints.
   */
  @RateLimit(60, 60_000)
  @Get(':id/leaderboard')
  async getLeaderboard(
    @Param('id', new ParseUUIDPipe({ version: '4' })) squadId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.squadsService.getLeaderboard(squadId, userId);
  }

  /**
   * Mengambil informasi detail dari suatu Circle.
   */
  @RateLimit(60, 60_000)
  @Get(':id')
  async getSquadDetail(
    @Param('id', new ParseUUIDPipe({ version: '4' })) squadId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.squadsService.getSquadDetail(squadId, userId);
  }

  /**
   * Keluar dari Circle.
   */
  @RateLimit(10, 60_000)
  @HttpCode(HttpStatus.OK)
  @Post(':id/leave')
  async leaveSquad(
    @Param('id', new ParseUUIDPipe({ version: '4' })) squadId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.squadsService.leaveSquad(squadId, userId);
  }

  /**
   * Mengeluarkan anggota dari Circle (hanya dapat dilakukan oleh Captain).
   */
  @RateLimit(15, 60_000)
  @HttpCode(HttpStatus.OK)
  @Delete(':id/members/:userId')
  async kickMember(
    @Param('id', new ParseUUIDPipe({ version: '4' })) squadId: string,
    @CurrentUser('id') captainId: string,
    @Param('userId', new ParseUUIDPipe({ version: '4' })) targetUserId: string,
  ) {
    return this.squadsService.kickMember(squadId, captainId, targetUserId);
  }
}
