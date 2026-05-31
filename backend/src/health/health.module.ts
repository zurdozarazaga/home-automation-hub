import { Module } from '@nestjs/common';
import { DevicesModule } from '../devices/devices.module';
import { HealthController } from './health.controller';

@Module({
  imports: [DevicesModule],
  controllers: [HealthController],
})
export class HealthModule {}
