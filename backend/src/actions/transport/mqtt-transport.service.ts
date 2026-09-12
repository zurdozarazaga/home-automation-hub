import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import type { Device } from '../../devices/interfaces/device.interface';
import type { ActionCommand } from '../interfaces/action.interface';
import type {
  DeviceTransport,
  TransportSendResult,
} from './device-transport.interface';

/**
 * Publish-only MQTT stub.
 *
 * Publishes each command exactly once and returns. It never subscribes,
 * holds no state, retries nothing, and needs no broker connection.
 *
 * TODO(mqtt-broker): replace `publish` with a real broker client
 * (connect/subscribe/retries/backoff) when full MQTT support lands.
 */
@Injectable()
export class MqttTransportService implements DeviceTransport {
  private readonly logger = new Logger(MqttTransportService.name);

  publish(topic: string, payload: string): void {
    this.logger.log(`MQTT publish to '${topic}': ${payload}`);
  }

  send(device: Device, command: ActionCommand): Promise<TransportSendResult> {
    if (!device.mqttTopic) {
      throw new BadRequestException(
        `Device ${device.id} has no mqttTopic configured`,
      );
    }

    this.publish(
      device.mqttTopic,
      JSON.stringify({ action: command.action, target: command.target }),
    );

    return Promise.resolve({
      endpoint: device.mqttTopic,
      httpStatusCode: 202,
    });
  }
}
