import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { DEVICE_COMMAND_STATUSES } from '../constants/device-command-statuses';
import type { DeviceCommandRepository } from '../interfaces/device-command-repository.interface';
import type {
  AcknowledgeDeviceCommandInput,
  CreateDeviceCommandInput,
} from '../interfaces/device-command-repository.interface';
import type {
  DeviceCommand,
  DeviceCommandResult,
  DeviceCommandStatus,
} from '../interfaces/device-command.interface';
import type { DeviceAction } from '../../actions/interfaces/action.interface';
import type { DeviceCommand as PrismaDeviceCommand } from '@prisma/client';

@Injectable()
export class PrismaDeviceCommandRepository implements DeviceCommandRepository {
  private readonly logger = new Logger(PrismaDeviceCommandRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateDeviceCommandInput): Promise<DeviceCommand> {
    try {
      const created = await this.prisma.deviceCommand.create({
        data: {
          deviceId: input.deviceId,
          action: input.action,
          target: input.target,
          endpoint: input.endpoint,
          status: 'pending',
          createdAt: input.createdAt ?? new Date(),
        },
      });

      return this.mapCommand(created);
    } catch (error) {
      this.logger.error(
        `Failed to enqueue device command for device: ${input.deviceId}`,
        error,
      );
      throw new InternalServerErrorException(
        'Failed to enqueue device command',
      );
    }
  }

  async findById(id: string): Promise<DeviceCommand | null> {
    try {
      const command = await this.prisma.deviceCommand.findUnique({
        where: { id },
      });

      return command ? this.mapCommand(command) : null;
    } catch (error) {
      this.logger.error(`Failed to fetch device command: ${id}`, error);
      throw new InternalServerErrorException('Failed to fetch device command');
    }
  }

  async claimPendingByDevice(
    deviceId: string,
    dispatchedAt: Date,
    limit: number,
  ): Promise<DeviceCommand[]> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const pending = await tx.deviceCommand.findMany({
          where: { deviceId, status: 'pending' },
          orderBy: { createdAt: 'asc' },
          take: limit,
        });
        const claimed: DeviceCommand[] = [];

        for (const command of pending) {
          // Conditional update: a concurrent sync that already claimed the
          // command makes this a no-op instead of a duplicate dispatch.
          const updated = await tx.deviceCommand.updateMany({
            where: { id: command.id, status: 'pending' },
            data: { status: 'dispatched', dispatchedAt },
          });

          if (updated.count === 1) {
            claimed.push(
              this.mapCommand({
                ...command,
                status: 'dispatched',
                dispatchedAt,
              }),
            );
          }
        }

        return claimed;
      });
    } catch (error) {
      this.logger.error(
        `Failed to claim pending commands for device: ${deviceId}`,
        error,
      );
      throw new InternalServerErrorException(
        'Failed to claim pending device commands',
      );
    }
  }

  async acknowledge(
    id: string,
    input: AcknowledgeDeviceCommandInput,
  ): Promise<DeviceCommand | null> {
    try {
      const updated = await this.prisma.deviceCommand.updateMany({
        where: { id, status: { in: ['pending', 'dispatched'] } },
        data: {
          status: 'acked',
          result: input.result,
          errorMessage: input.errorMessage ?? null,
          ackedAt: input.ackedAt,
        },
      });

      if (updated.count === 0) {
        return null;
      }

      return this.findById(id);
    } catch (error) {
      this.logger.error(`Failed to acknowledge device command: ${id}`, error);
      throw new InternalServerErrorException(
        'Failed to acknowledge device command',
      );
    }
  }

  async expireStale(
    cutoff: Date,
    errorMessage: string,
  ): Promise<DeviceCommand[]> {
    try {
      const stale = await this.prisma.deviceCommand.findMany({
        where: {
          status: { in: ['pending', 'dispatched'] },
          OR: [
            { dispatchedAt: { lt: cutoff } },
            { dispatchedAt: null, createdAt: { lt: cutoff } },
          ],
        },
        orderBy: { createdAt: 'asc' },
      });

      if (stale.length === 0) {
        return [];
      }

      await this.prisma.deviceCommand.updateMany({
        where: {
          id: { in: stale.map((command) => command.id) },
          status: { in: ['pending', 'dispatched'] },
        },
        data: {
          status: 'expired',
          result: 'failed',
          errorMessage,
        },
      });

      return stale.map((command) =>
        this.mapCommand({
          ...command,
          status: 'expired',
          result: 'failed',
          errorMessage,
        }),
      );
    } catch (error) {
      this.logger.error('Failed to expire stale device commands', error);
      throw new InternalServerErrorException(
        'Failed to expire stale device commands',
      );
    }
  }

  private mapCommand(command: PrismaDeviceCommand): DeviceCommand {
    return {
      id: command.id,
      deviceId: command.deviceId,
      action: this.parseAction(command.action),
      target: command.target,
      endpoint: command.endpoint ?? undefined,
      status: this.parseStatus(command.status),
      result: command.result ? this.parseResult(command.result) : undefined,
      errorMessage: command.errorMessage ?? undefined,
      createdAt: command.createdAt,
      dispatchedAt: command.dispatchedAt ?? undefined,
      ackedAt: command.ackedAt ?? undefined,
    };
  }

  private parseAction(action: string): DeviceAction {
    if (action === 'turn_on' || action === 'turn_off') {
      return action;
    }

    this.logger.error(`Invalid device command action in database: ${action}`);
    throw new InternalServerErrorException(
      'Invalid device command action in database',
    );
  }

  private parseStatus(status: string): DeviceCommandStatus {
    if ((DEVICE_COMMAND_STATUSES as readonly string[]).includes(status)) {
      return status as DeviceCommandStatus;
    }

    this.logger.error(`Invalid device command status in database: ${status}`);
    throw new InternalServerErrorException(
      'Invalid device command status in database',
    );
  }

  private parseResult(result: string): DeviceCommandResult {
    if (result === 'success' || result === 'failed') {
      return result;
    }

    this.logger.error(`Invalid device command result in database: ${result}`);
    throw new InternalServerErrorException(
      'Invalid device command result in database',
    );
  }
}
