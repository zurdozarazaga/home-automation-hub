import { BadGatewayException, Inject, Injectable } from '@nestjs/common';
import { DevicesService } from '../devices/devices.service';
import { ACTION_LOG_REPOSITORY } from './constants/action-log-repository.token';
import { ESP32_CLIENT } from './constants/esp32-client.token';
import { ExecuteActionDto } from './dto/execute-action.dto';
import { ActionLogRepository } from './interfaces/action-log-repository.interface';
import {
  ActionCommand,
  ActionExecutionResult,
  ActionResultStatus,
} from './interfaces/action.interface';
import {
  Esp32Client,
  Esp32CommandResponse,
} from './interfaces/esp32-client.interface';

@Injectable()
export class ActionsService {
  constructor(
    private readonly devicesService: DevicesService,
    @Inject(ESP32_CLIENT)
    private readonly esp32Client: Esp32Client,
    @Inject(ACTION_LOG_REPOSITORY)
    private readonly actionLogRepository: ActionLogRepository,
  ) {}

  async execute(
    deviceId: string,
    executeActionDto: ExecuteActionDto,
  ): Promise<ActionExecutionResult> {
    const command: ActionCommand = {
      deviceId,
      action: executeActionDto.action,
      target: executeActionDto.target,
    };
    const device = await this.devicesService.findById(deviceId);

    try {
      const response = await this.esp32Client.sendAction(device, command);
      await this.logAction(command, response, 'success');

      return {
        deviceId,
        action: command.action,
        target: command.target,
        endpoint: response.endpoint,
        result: 'success',
        httpStatusCode: response.httpStatusCode,
        executedAt: new Date(),
      };
    } catch (error) {
      const fallbackResponse: Esp32CommandResponse = {
        endpoint: this.resolveEndpoint(command),
        httpStatusCode: 502,
      };

      await this.logAction(
        command,
        fallbackResponse,
        'failed',
        error instanceof Error ? error.message : 'Unknown error',
      );

      if (error instanceof BadGatewayException) {
        throw error;
      }

      throw new BadGatewayException(
        `Device ${deviceId} failed while executing action`,
      );
    }
  }

  private logAction(
    command: ActionCommand,
    response: Esp32CommandResponse,
    result: ActionResultStatus,
    errorMessage?: string,
  ): Promise<void> {
    return this.actionLogRepository
      .create({
        deviceId: command.deviceId,
        action: command.action,
        target: command.target,
        endpoint: response.endpoint,
        result,
        httpStatusCode: response.httpStatusCode,
        createdAt: new Date(),
        errorMessage,
      })
      .then(() => undefined);
  }

  private resolveEndpoint(command: ActionCommand): string {
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

    return endpoints[command.target][command.action];
  }

  // TODO(mqtt): Add MQTT publisher adapter and route command dispatch through a transport strategy.
  // TODO(websocket): Add WebSocket event broadcasting for action lifecycle updates.
}
