import { Module } from '@nestjs/common';
import { DEVICE_REPOSITORY } from './constants/device-repository.token';
import { DEVICE_DRIVER, DRIVER_REGISTRY } from './constants/driver.tokens';
import { DevicesController } from './devices.controller';
import { DevicesService } from './devices.service';
import { DeviceDriver } from './drivers/device-driver.interface';
import { DriverResolverService } from './drivers/driver-resolver.service';
import { Esp32Driver } from './drivers/esp32.driver';
import { InMemoryDeviceRepository } from './repositories/in-memory-device.repository';
import { PrismaDeviceRepository } from './repositories/prisma-device.repository';

const isPrismaDataSource = process.env.DATA_SOURCE === 'prisma';

@Module({
  controllers: [DevicesController],
  providers: [
    DevicesService,
    PrismaDeviceRepository,
    Esp32Driver,
    DriverResolverService,
    {
      provide: DRIVER_REGISTRY,
      useFactory: (esp32Driver: Esp32Driver): Map<string, DeviceDriver> =>
        new Map([[esp32Driver.name, esp32Driver]]),
      inject: [Esp32Driver],
    },
    {
      provide: DEVICE_DRIVER,
      useExisting: DriverResolverService,
    },
    {
      provide: DEVICE_REPOSITORY,
      useClass: isPrismaDataSource
        ? PrismaDeviceRepository
        : InMemoryDeviceRepository,
    },
  ],
  exports: [DevicesService, DEVICE_DRIVER, DRIVER_REGISTRY, Esp32Driver],
})
export class DevicesModule {}
