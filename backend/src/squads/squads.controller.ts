import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { SquadsService } from './squads.service';
import { CreateSquadDto, JoinSquadDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('squads')
export class SquadsController {
  constructor(private readonly squadsService: SquadsService) {}

  /**
   * Membuat Circle baru dengan kode 8 karakter acak unik dan menetapkan pembuat sebagai CAPTAIN.
   */
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
  @Get('my')
  async getMySquads(@CurrentUser('id') userId: string) {
    return this.squadsService.getMySquads(userId);
  }

  /**
   * Mengambil urutan peringkat anggota (Leaderboard) Circle berdasarkan rankPoints.
   */
  @Get(':id/leaderboard')
  async getLeaderboard(
    @Param('id') squadId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.squadsService.getLeaderboard(squadId, userId);
  }

  /**
   * Mengambil informasi detail dari suatu Circle.
   */
  @Get(':id')
  async getSquadDetail(
    @Param('id') squadId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.squadsService.getSquadDetail(squadId, userId);
  }

  /**
   * Keluar dari Circle.
   */
  @HttpCode(HttpStatus.OK)
  @Post(':id/leave')
  async leaveSquad(
    @Param('id') squadId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.squadsService.leaveSquad(squadId, userId);
  }

  /**
   * Mengeluarkan anggota dari Circle (hanya dapat dilakukan oleh Captain).
   */
  @HttpCode(HttpStatus.OK)
  @Delete(':id/members/:userId')
  async kickMember(
    @Param('id') squadId: string,
    @CurrentUser('id') captainId: string,
    @Param('userId') targetUserId: string,
  ) {
    return this.squadsService.kickMember(squadId, captainId, targetUserId);
  }
}
