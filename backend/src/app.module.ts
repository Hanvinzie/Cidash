import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from './auth/auth.module';
import { DatabaseModule } from './database/database.module';
import { SquadsModule } from './squads/squads.module';
import { QuestsModule } from './quests/quests.module';
import { ActivitiesModule } from './activities/activities.module';
import { RateLimitGuard } from './common/guards/rate-limit.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', 'backend/.env'],
    }),
    ScheduleModule.forRoot(),
    DatabaseModule,
    AuthModule,
    SquadsModule,
    QuestsModule,
    ActivitiesModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: RateLimitGuard,
    },
  ],
})
export class AppModule {}
