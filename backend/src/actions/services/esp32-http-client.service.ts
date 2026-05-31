import { BadGatewayException, Injectable } from '@nestjs/common';
import { Device } from '../../devices/interfaces/device.interface';
import { ActionCommand } from '../interfaces/action.interface';
import {
  Esp32Client,
  Esp32CommandResponse,
} from '../interfaces/esp32-client.interface';

@Injectable()
export class Esp32HttpClientService implements Esp32Client {
  async sendAction(
    device: Device,
    command: ActionCommand,
  ): Promise<Esp32CommandResponse> {
    const endpoint = this.resolveEndpoint(command.action, command.target);
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

  private resolveEndpoint(
    action: ActionCommand['action'],
    target: ActionCommand['target'],
  ): string {
    const endpoints: Record<
      ActionCommand['target'],
      Record<ActionCommand['action'], string>
    > = {
      riego: {
        turn_on: '/riego/on',
        turn_off: '/riego/off',
      },
      luces: {
        turn_on: '/luces/on',
        turn_off: '/luces/off',
      },
    };

    return endpoints[target][action];
  }
}
