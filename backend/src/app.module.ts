import { Module } from '@nestjs/common';
import { ActionsModule } from './actions/actions.module';
import { AuthModule } from './auth/auth.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { DevicesModule } from './devices/devices.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    DatabaseModule,
    DevicesModule,
    ActionsModule,
    HealthModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
