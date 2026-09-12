import { BadGatewayException, Inject, Injectable } from '@nestjs/common';
import { DEVICE_DRIVER } from '../../devices/constants/driver.tokens';
import type { DriverResolverService } from '../../devices/drivers/driver-resolver.service';
import type { Device } from '../../devices/interfaces/device.interface';
import type { ActionCommand } from '../interfaces/action.interface';
import type {
  DeviceTransport,
  TransportSendResult,
} from './device-transport.interface';

/**
 * HTTP transport for device command delivery.
 *
 * Verbatim extraction of the former ESP32 HTTP client: the endpoint table
 * now lives in the resolved driver, so no endpoint copies remain here.
 */
@Injectable()
export class HttpTransportService implements DeviceTransport {
  constructor(
    @Inject(DEVICE_DRIVER)
    private readonly driverResolver: DriverResolverService,
  ) {}

  async send(
    device: Device,
    command: ActionCommand,
  ): Promise<TransportSendResult> {
    const driver = this.driverResolver.resolve(device.driver);
    const endpoint = driver.resolveEndpoint(command.action, command.target);
    const url = `http://${device.ipAddress}:${device.port}${endpoint}`;

    try {
      const response = await fetch(url, { method: 'POST' });

      if (!response.ok) {
        throw new BadGatewayException(
          `Device ${device.id} returned status ${response.status}`,
        );
      }

      return {
        endpoint,
        httpStatusCode: response.status,
      };
    } catch (error) {
      if (error instanceof BadGatewayException) {
        throw error;
      }

      throw new BadGatewayException(
        `Device ${device.id} is unreachable at ${device.ipAddress}:${device.port}`,
      );
    }
  }
}
