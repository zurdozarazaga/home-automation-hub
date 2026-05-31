import { Module } from '@nestjs/common';
import { DEVICE_REPOSITORY } from './constants/device-repository.token';
import { DevicesController } from './devices.controller';
import { DevicesService } from './devices.service';
import { InMemoryDeviceRepository } from './repositories/in-memory-device.repository';
import { PrismaDeviceRepository } from './repositories/prisma-device.repository';

const isPrismaDataSource = process.env.DATA_SOURCE === 'prisma';

@Module({
  controllers: [DevicesController],
  providers: [
    DevicesService,
    PrismaDeviceRepository,
    {
      provide: DEVICE_REPOSITORY,
      useClass: isPrismaDataSource
        ? PrismaDeviceRepository
        : InMemoryDeviceRepository,
    },
  ],
  exports: [DevicesService],
})
export class DevicesModule {}
