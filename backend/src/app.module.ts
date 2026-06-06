import { Module } from '@nestjs/common';
import { ActionsModule } from './actions/actions.module';
import { AuthModule } from './auth/auth.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { DevicesModule } from './devices/devices.module';
import { HealthModule } from './health/health.module';
import { N8nModule } from './integrations/n8n/n8n.module';

@Module({
  imports: [
    DatabaseModule,
    DevicesModule,
    ActionsModule,
    HealthModule,
    AuthModule,
    N8nModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
