import { Device } from '../../devices/interfaces/device.interface';
import { ActionCommand } from '../interfaces/action.interface';

export interface TransportSendResult {
  endpoint: string;
  httpStatusCode: number;
}

/**
 * Single dispatch contract for device command delivery.
 *
 * HTTP keeps current behavior; MQTT arrives as a publish-only stub.
 * Services depend on this token, never on a concrete client.
 *
 * TODO(mqtt): add publish-only MqttTransport behind MQTT_ENABLED switch.
 */
export interface DeviceTransport {
  send(device: Device, command: ActionCommand): Promise<TransportSendResult>;
}
