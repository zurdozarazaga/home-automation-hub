import { Injectable } from '@nestjs/common';
import { Device } from '../../devices/interfaces/device.interface';
import { ActionCommand } from '../interfaces/action.interface';
import {
  Esp32Client,
  Esp32CommandResponse,
} from '../interfaces/esp32-client.interface';

@Injectable()
export class InMemoryEsp32ClientService implements Esp32Client {
  sendAction(
    _device: Device,
    command: ActionCommand,
  ): Promise<Esp32CommandResponse> {
    return Promise.resolve({
      endpoint: this.resolveEndpoint(command.action, command.target),
      httpStatusCode: 200,
    });
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
