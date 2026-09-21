import { Module } from '@nestjs/common';
import { DevicesModule } from '../devices/devices.module';
import { TelemetryModule } from '../telemetry/telemetry.module';
import { DevicePollerService } from './device-poller.service';

/**
 * Device monitoring: pulls GET /estado from ESP32 boards so device status
 * stays fresh and DHT22 readings reach the telemetry repository. The
 * firmware stays untouched (no push/forwarder on the board).
 */
@Module({
  imports: [DevicesModule, TelemetryModule],
  providers: [DevicePollerService],
})
export class MonitoringModule {}
