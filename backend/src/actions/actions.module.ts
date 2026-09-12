import { Module } from '@nestjs/common';
import { DevicesModule } from '../devices/devices.module';
import { ActionsController } from './actions.controller';
import { ActionsService } from './actions.service';
import { ACTION_LOG_REPOSITORY } from './constants/action-log-repository.token';
import { DEVICE_TRANSPORT } from './constants/device-transport.token';
import { InMemoryActionLogRepository } from './repositories/in-memory-action-log.repository';
import { PrismaActionLogRepository } from './repositories/prisma-action-log.repository';
import { HttpTransportService } from './transport/http-transport.service';
import { InMemoryTransportService } from './transport/in-memory-transport.service';
import { MqttTransportService } from './transport/mqtt-transport.service';
import { TransportDispatcherService } from './transport/transport-dispatcher.service';

const isPrismaDataSource = process.env.DATA_SOURCE === 'prisma';

@Module({
  imports: [DevicesModule],
  controllers: [ActionsController],
  providers: [
    ActionsService,
    HttpTransportService,
    InMemoryTransportService,
    MqttTransportService,
    TransportDispatcherService,
    PrismaActionLogRepository,
    {
      provide: DEVICE_TRANSPORT,
      useExisting: TransportDispatcherService,
    },
    {
      provide: ACTION_LOG_REPOSITORY,
      useClass: isPrismaDataSource
        ? PrismaActionLogRepository
        : InMemoryActionLogRepository,
    },
  ],
})
export class ActionsModule {}
