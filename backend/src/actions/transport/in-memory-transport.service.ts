import { Inject, Injectable } from '@nestjs/common';
import { DEVICE_DRIVER } from '../../devices/constants/driver.tokens';
import type { DriverResolverService } from '../../devices/drivers/driver-resolver.service';
import type { Device } from '../../devices/interfaces/device.interface';
import type { ActionCommand } from '../interfaces/action.interface';
import type {
  DeviceTransport,
  TransportSendResult,
} from './device-transport.interface';

/**
 * In-memory transport for local development (`DATA_SOURCE` unset).
 *
 * Resolves the endpoint through the driver like every other transport,
 * then short-circuits delivery with a synthetic 200. No device contact.
 */
@Injectable()
export class InMemoryTransportService implements DeviceTransport {
  constructor(
    @Inject(DEVICE_DRIVER)
    private readonly driverResolver: DriverResolverService,
  ) {}

  async send(
    device: Device,
    command: ActionCommand,
  ): Promise<TransportSendResult> {
    const driver = this.driverResolver.resolve(device.driver);

    return {
      endpoint: driver.resolveEndpoint(command.action, command.target),
      httpStatusCode: 200,
    };
  }
}
