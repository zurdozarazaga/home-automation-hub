import {
  BadGatewayException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { resolveDeviceHttpTimeoutMs } from '../../common/http/device-http';
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
 * Every request carries an AbortSignal timeout so an unresponsive board
 * becomes a logged 502 instead of an open socket.
 */
@Injectable()
export class HttpTransportService implements DeviceTransport {
  private readonly logger = new Logger(HttpTransportService.name);

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
    const timeoutMs = resolveDeviceHttpTimeoutMs();

    try {
      const response = await fetch(url, {
        method: 'POST',
        signal: AbortSignal.timeout(timeoutMs),
      });

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

      const reason = this.describeFailure(error, timeoutMs);
      this.logger.error(
        `Device ${device.id} at ${device.ipAddress}:${device.port} ${reason} (${new Date().toISOString()})`,
      );

      throw new BadGatewayException(
        `Device ${device.id} at ${device.ipAddress}:${device.port} ${reason}`,
      );
    }
  }
  private describeFailure(error: unknown, timeoutMs: number): string {
    // AbortSignal.timeout rejects with a DOMException named TimeoutError.
    // Duck-typing the name avoids realm-dependent instanceof checks.
    const errorName = this.readErrorName(error);
    const isTimeout =
      errorName === 'TimeoutError' || errorName === 'AbortError';

    return isTimeout ? `timed out after ${timeoutMs}ms` : 'is unreachable';
  }

  private readErrorName(error: unknown): string | null {
    if (typeof error !== 'object' || error === null || !('name' in error)) {
      return null;
    }

    const name = (error as { name?: unknown }).name;

    return typeof name === 'string' ? name : null;
  }
}
