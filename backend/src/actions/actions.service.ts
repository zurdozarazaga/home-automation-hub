import {
  BadGatewayException,
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { DEVICE_DRIVER } from '../devices/constants/driver.tokens';
import { DevicesService } from '../devices/devices.service';
import { DriverResolverService } from '../devices/drivers/driver-resolver.service';
import { ACTION_LOG_REPOSITORY } from './constants/action-log-repository.token';
import { ESP32_CLIENT } from './constants/esp32-client.token';
import { ExecuteActionDto } from './dto/execute-action.dto';
import type { ActionLogRepository } from './interfaces/action-log-repository.interface';
import type {
  ActionCommand,
  ActionExecutionResult,
  ActionResultStatus,
} from './interfaces/action.interface';
import type {
  Esp32Client,
  Esp32CommandResponse,
} from './interfaces/esp32-client.interface';

@Injectable()
export class ActionsService {
  private readonly logger = new Logger(ActionsService.name);

  constructor(
    private readonly devicesService: DevicesService,
    @Inject(DEVICE_DRIVER)
    private readonly driverResolver: DriverResolverService,
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
    const driver = this.driverResolver.resolve(device.driver);

    if (
      !device.capabilities.includes(command.target) ||
      !driver.supports(command.target)
    ) {
      throw new BadRequestException(
        `Target '${command.target}' is not supported by device ${deviceId} (driver '${driver.name}')`,
      );
    }

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
        endpoint: driver.resolveEndpoint(command.action, command.target),
        httpStatusCode: 502,
      };

      this.logger.error(
        `Action '${command.action}' on target '${command.target}' failed for device ${deviceId} at ${new Date().toISOString()}`,
        error instanceof Error ? error.stack : error,
      );

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

  // TODO(mqtt): Add MQTT publisher adapter and route command dispatch through a transport strategy.
  // TODO(websocket): Add WebSocket event broadcasting for action lifecycle updates.
}
