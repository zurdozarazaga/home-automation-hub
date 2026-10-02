import {
  BadGatewayException,
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import {
  DEVICE_OFFLINE_THRESHOLD_MS,
  isPushLinkMode,
} from '../common/device-link';
import { DEVICE_COMMAND_REPOSITORY } from '../board/constants/device-command-repository.token';
import type { DeviceCommandRepository } from '../board/interfaces/device-command-repository.interface';
import { DEVICE_DRIVER } from '../devices/constants/driver.tokens';
import { DevicesService } from '../devices/devices.service';
import type { DeviceDriver } from '../devices/drivers/device-driver.interface';
import { DriverResolverService } from '../devices/drivers/driver-resolver.service';
import type { Device } from '../devices/interfaces/device.interface';
import { ACTION_LOG_REPOSITORY } from './constants/action-log-repository.token';
import { DEVICE_TRANSPORT } from './constants/device-transport.token';
import { ExecuteActionDto } from './dto/execute-action.dto';
import type { ActionLogRepository } from './interfaces/action-log-repository.interface';
import type {
  ActionCommand,
  ActionExecutionResult,
  ActionResultStatus,
  QueuedActionExecutionResult,
} from './interfaces/action.interface';
import type {
  DeviceTransport,
  TransportSendResult,
} from './transport/device-transport.interface';

@Injectable()
export class ActionsService {
  private readonly logger = new Logger(ActionsService.name);

  constructor(
    private readonly devicesService: DevicesService,
    @Inject(DEVICE_DRIVER)
    private readonly driverResolver: DriverResolverService,
    @Inject(DEVICE_TRANSPORT)
    private readonly transport: DeviceTransport,
    @Inject(ACTION_LOG_REPOSITORY)
    private readonly actionLogRepository: ActionLogRepository,
    @Inject(DEVICE_COMMAND_REPOSITORY)
    private readonly commandRepository: DeviceCommandRepository,
  ) {}

  /**
   * Executes an action through the active link mode.
   *
   * Pull: sends over HTTP and logs the result right away (legacy behavior).
   * Push: queues a DeviceCommand for the board to pick up on its next
   * POST /board/sync; the caller sees `result: "queued"` (HTTP 202).
   */
  async execute(
    deviceId: string,
    executeActionDto: ExecuteActionDto,
  ): Promise<ActionExecutionResult | QueuedActionExecutionResult> {
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

    if (isPushLinkMode()) {
      return this.queueForBoard(device, command, driver);
    }

    try {
      const response = await this.transport.send(device, command);
      await this.recordOutcome(command, response, 'success');

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
      const fallbackResponse: TransportSendResult = {
        endpoint: driver.resolveEndpoint(command.action, command.target),
        httpStatusCode: 502,
      };

      this.logger.error(
        `Action '${command.action}' on target '${command.target}' failed for device ${deviceId} at ${new Date().toISOString()}`,
        error instanceof Error ? error.stack : error,
      );

      await this.recordOutcome(
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

  /**
   * Push link: persist the command for the board to pick up.
   *
   * An ActionLog is intentionally NOT written here. In push mode the final
   * outcome arrives with the board ack (POST /board/sync), which records it
   * once through `recordOutcome`, and the sweep records "ack timeout" when
   * the board never answers. A stale board keeps the n8n contract: 502 now,
   * with the failed ActionLog written before throwing.
   */
  private async queueForBoard(
    device: Device,
    command: ActionCommand,
    driver: DeviceDriver,
  ): Promise<QueuedActionExecutionResult> {
    const endpoint = driver.resolveEndpoint(command.action, command.target);
    const now = Date.now();
    const lastSeenAt = device.lastSeenAt;
    const isOffline =
      lastSeenAt === null ||
      now - lastSeenAt.getTime() > DEVICE_OFFLINE_THRESHOLD_MS;

    if (isOffline) {
      const lastSeenDescription = lastSeenAt
        ? `last seen ${Math.max(0, Math.round((now - lastSeenAt.getTime()) / 1000))}s ago`
        : 'never seen';
      const errorMessage = `Device ${device.id} is offline (${lastSeenDescription})`;

      await this.recordOutcome(
        command,
        { endpoint, httpStatusCode: 502 },
        'failed',
        errorMessage,
      );

      throw new BadGatewayException(errorMessage);
    }

    const queuedCommand = await this.commandRepository.create({
      deviceId: device.id,
      action: command.action,
      target: command.target,
      endpoint,
    });

    return {
      deviceId: device.id,
      action: command.action,
      target: command.target,
      endpoint,
      commandId: queuedCommand.id,
      result: 'queued',
      executedAt: new Date(),
    };
  }

  /**
   * Persists one ActionLog row. Shared by the pull path, the push enqueue
   * rejection, the board ack and the ack-timeout sweep so every execution
   * writes the exact same shape.
   */
  async recordOutcome(
    command: ActionCommand,
    response: TransportSendResult,
    result: ActionResultStatus,
    errorMessage?: string,
  ): Promise<void> {
    await this.actionLogRepository.create({
      deviceId: command.deviceId,
      action: command.action,
      target: command.target,
      endpoint: response.endpoint,
      result,
      httpStatusCode: response.httpStatusCode,
      createdAt: new Date(),
      errorMessage,
    });
  }

  // TODO(websocket): Add WebSocket event broadcasting for action lifecycle updates.
}
