import { Module } from '@nestjs/common';
import { DevicesModule } from '../devices/devices.module';
import { TELEMETRY_REPOSITORY } from './constants/telemetry-repository.token';
import { InMemoryTelemetryRepository } from './repositories/in-memory-telemetry.repository';
import { PrismaTelemetryRepository } from './repositories/prisma-telemetry.repository';
import { TelemetryController } from './telemetry.controller';
import { TelemetryService } from './telemetry.service';

const isPrismaDataSource = process.env.DATA_SOURCE === 'prisma';

@Module({
  imports: [DevicesModule],
  controllers: [TelemetryController],
  providers: [
    TelemetryService,
    PrismaTelemetryRepository,
    {
      provide: TELEMETRY_REPOSITORY,
      useClass: isPrismaDataSource
        ? PrismaTelemetryRepository
        : InMemoryTelemetryRepository,
    },
  ],
  exports: [TelemetryService],
})
export class TelemetryModule {}
