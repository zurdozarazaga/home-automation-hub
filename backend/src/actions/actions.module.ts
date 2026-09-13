import { Module } from '@nestjs/common';
import { DevicesModule } from '../devices/devices.module';
import { ActionsController } from './actions.controller';
import { ActionsService } from './actions.service';
import { ACTION_LOG_REPOSITORY } from './constants/action-log-repository.token';
import { ESP32_CLIENT } from './constants/esp32-client.token';
import { InMemoryActionLogRepository } from './repositories/in-memory-action-log.repository';
import { PrismaActionLogRepository } from './repositories/prisma-action-log.repository';
import { InMemoryEsp32ClientService } from './services/in-memory-esp32-client.service';
import { Esp32HttpClientService } from './services/esp32-http-client.service';

const isPrismaDataSource = process.env.DATA_SOURCE === 'prisma';
const esp32ClientProvider = isPrismaDataSource
  ? Esp32HttpClientService
  : InMemoryEsp32ClientService;

@Module({
  imports: [DevicesModule],
  controllers: [ActionsController],
  providers: [
    ActionsService,
    Esp32HttpClientService,
    InMemoryEsp32ClientService,
    PrismaActionLogRepository,
    {
      provide: ESP32_CLIENT,
      useClass: esp32ClientProvider,
    },
    {
      provide: ACTION_LOG_REPOSITORY,
      useClass: isPrismaDataSource
        ? PrismaActionLogRepository
        : InMemoryActionLogRepository,
    },
  ],
  exports: [ActionsService],
})
export class ActionsModule {}
