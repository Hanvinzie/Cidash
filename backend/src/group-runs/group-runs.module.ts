import { Module } from '@nestjs/common';
import { GroupRunsController } from './group-runs.controller';
import { GroupRunsService } from './group-runs.service';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [GroupRunsController],
  providers: [GroupRunsService],
  exports: [GroupRunsService],
})
export class GroupRunsModule {}
