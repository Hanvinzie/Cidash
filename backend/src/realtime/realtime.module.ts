import { Module } from '@nestjs/common';
import { RealtimeController } from './realtime.controller';
import { RealtimeService } from './realtime.service';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [RealtimeController],
  providers: [RealtimeService],
})
export class RealtimeModule {}
