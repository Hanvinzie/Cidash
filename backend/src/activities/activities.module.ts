import { Module } from '@nestjs/common';
import { ActivitiesController } from './activities.controller';
import { ActivitiesService } from './activities.service';
import { AntiCheatService } from './services/anti-cheat.service';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [ActivitiesController],
  providers: [ActivitiesService, AntiCheatService],
  exports: [ActivitiesService, AntiCheatService],
})
export class ActivitiesModule {}
