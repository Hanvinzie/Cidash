import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { GroupRunsService } from './group-runs.service';
import { CreateGroupRunDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RateLimit } from '../common/guards/rate-limit.guard';

@UseGuards(JwtAuthGuard)
@Controller('group-runs')
export class GroupRunsController {
  constructor(private readonly groupRuns: GroupRunsService) {}

  /** Sesi Group Run yang masih terbuka (menunggu / berjalan) di sebuah circle. */
  @RateLimit(60, 60_000)
  @Get()
  list(@CurrentUser('id') userId: string, @Query('circleId', ParseUUIDPipe) circleId: string) {
    return this.groupRuns.list(userId, circleId);
  }

  @RateLimit(10, 60_000)
  @Post()
  create(@CurrentUser('id') userId: string, @Body() dto: CreateGroupRunDto) {
    return this.groupRuns.create(userId, dto.circleId);
  }

  @RateLimit(60, 60_000)
  @Get(':id')
  get(@CurrentUser('id') userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.groupRuns.get(userId, id);
  }

  @RateLimit(20, 60_000)
  @HttpCode(HttpStatus.OK)
  @Post(':id/join')
  join(@CurrentUser('id') userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.groupRuns.join(userId, id);
  }

  @RateLimit(10, 60_000)
  @HttpCode(HttpStatus.OK)
  @Post(':id/start')
  start(@CurrentUser('id') userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.groupRuns.start(userId, id);
  }

  @RateLimit(20, 60_000)
  @HttpCode(HttpStatus.OK)
  @Post(':id/leave')
  leave(@CurrentUser('id') userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.groupRuns.leave(userId, id);
  }

  @RateLimit(10, 60_000)
  @HttpCode(HttpStatus.OK)
  @Post(':id/finish')
  finish(@CurrentUser('id') userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.groupRuns.finish(userId, id);
  }
}
