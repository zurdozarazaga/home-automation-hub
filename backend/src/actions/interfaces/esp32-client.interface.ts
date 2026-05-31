import { Device } from '../../devices/interfaces/device.interface';
import { ActionCommand } from './action.interface';

export interface Esp32CommandResponse {
  endpoint: string;
  httpStatusCode: number;
}

export interface Esp32Client {
  sendAction(
    device: Device,
    command: ActionCommand,
  ): Promise<Esp32CommandResponse>;
}
