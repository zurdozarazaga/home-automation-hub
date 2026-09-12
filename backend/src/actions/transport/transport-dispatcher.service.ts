import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { DEVICE_DRIVER } from '../../devices/constants/driver.tokens';
import type { DriverResolverService } from '../../devices/drivers/driver-resolver.service';
import type { Device } from '../../devices/interfaces/device.interface';
import type { ActionCommand } from '../interfaces/action.interface';
import type {
  DeviceTransport,
  TransportSendResult,
} from './device-transport.interface';
import { HttpTransportService } from './http-transport.service';
import { InMemoryTransportService } from './in-memory-transport.service';
import { MqttTransportService } from './mqtt-transport.service';

/**
 * Single dispatch point for device command delivery.
 *
 * Routes by the resolved driver's `transport`: `mqtt` drivers go to the
 * publish-only stub (gated by `MQTT_ENABLED`), everything else goes to
 * HTTP in `prisma` mode or the in-memory fake in local development.
 * Services depend on the `DEVICE_TRANSPORT` token, never on a transport.
 */
@Injectable()
export class TransportDispatcherService implements DeviceTransport {
  constructor(
    @Inject(DEVICE_DRIVER)
    private readonly driverResolver: DriverResolverService,
    private readonly httpTransport: HttpTransportService,
    private readonly mqttTransport: MqttTransportService,
    private readonly inMemoryTransport: InMemoryTransportService,
  ) {}

  async send(
    device: Device,
    command: ActionCommand,
  ): Promise<TransportSendResult> {
    const driver = this.driverResolver.resolve(device.driver);

    if (driver.transport === 'mqtt') {
      if (process.env.MQTT_ENABLED !== 'true') {
        throw new BadRequestException(
          'MQTT transport is disabled (MQTT_ENABLED is not true)',
        );
      }

      return this.mqttTransport.send(device, command);
    }

    if (process.env.DATA_SOURCE === 'prisma') {
      return this.httpTransport.send(device, command);
    }

    return this.inMemoryTransport.send(device, command);
  }
}
