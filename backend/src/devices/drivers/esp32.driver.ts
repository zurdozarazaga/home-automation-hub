import { BadRequestException, Injectable } from '@nestjs/common';
import { DeviceAction } from '../../actions/interfaces/action.interface';
import { DeviceDriver } from './device-driver.interface';

/**
 * ESP32-over-HTTP driver. Owns the endpoint table that used to be
 * duplicated across ActionsService and the ESP32 clients.
 */
@Injectable()
export class Esp32Driver implements DeviceDriver {
  readonly name = 'esp32';
  readonly transport = 'http' as const;

  private readonly endpoints: Record<string, Record<DeviceAction, string>> = {
    riego: {
      turn_on: '/riego/on',
      turn_off: '/riego/off',
    },
    luces: {
      turn_on: '/luces/on',
      turn_off: '/luces/off',
    },
  };

  supports(target: string): boolean {
    return target in this.endpoints;
  }

  resolveEndpoint(action: DeviceAction, target: string): string {
    const endpoint = this.endpoints[target]?.[action];

    if (!endpoint) {
      throw new BadRequestException(
        `ESP32 driver cannot resolve endpoint for target '${target}' and action '${action}'`,
      );
    }

    return endpoint;
  }
}
