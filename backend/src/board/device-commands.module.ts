import { Module } from '@nestjs/common';
import { DEVICE_COMMAND_REPOSITORY } from './constants/device-command-repository.token';
import { InMemoryDeviceCommandRepository } from './repositories/in-memory-device-command.repository';
import { PrismaDeviceCommandRepository } from './repositories/prisma-device-command.repository';

const isPrismaDataSource = process.env.DATA_SOURCE === 'prisma';

/**
 * Persistence for the push-link command queue. Standalone so both the
 * actions module (enqueue) and the board module (dispatch/ack/sweep) can
 * depend on it without a circular module graph.
 */
@Module({
  providers: [
    PrismaDeviceCommandRepository,
    {
      provide: DEVICE_COMMAND_REPOSITORY,
      useClass: isPrismaDataSource
        ? PrismaDeviceCommandRepository
        : InMemoryDeviceCommandRepository,
    },
  ],
  exports: [DEVICE_COMMAND_REPOSITORY],
})
export class DeviceCommandsModule {}
