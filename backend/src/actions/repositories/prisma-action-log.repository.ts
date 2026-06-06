import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { ActionLogRepository } from '../interfaces/action-log-repository.interface';
import {
  ActionLog,
  ActionResultStatus,
  DeviceAction,
  DeviceTarget,
} from '../interfaces/action.interface';

@Injectable()
export class PrismaActionLogRepository implements ActionLogRepository {
  private readonly logger = new Logger(PrismaActionLogRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(log: Omit<ActionLog, 'id'>): Promise<ActionLog> {
    try {
      const created = await this.prisma.actionLog.create({
        data: {
          deviceId: log.deviceId,
          action: log.action,
          target: log.target,
          endpoint: log.endpoint,
          result: log.result,
          httpStatusCode: log.httpStatusCode,
          errorMessage: log.errorMessage,
          createdAt: log.createdAt,
        },
      });

      return this.mapActionLog(created);
    } catch (error) {
      this.logger.error(
        `Failed to create action log for device: ${log.deviceId}`,
        error,
      );
      throw new InternalServerErrorException('Failed to persist action log');
    }
  }

  async findAllByDeviceId(deviceId: string): Promise<ActionLog[]> {
    try {
      const logs = await this.prisma.actionLog.findMany({
        where: { deviceId },
        orderBy: { createdAt: 'desc' },
      });

      return logs.map((log) => this.mapActionLog(log));
    } catch (error) {
      this.logger.error(
        `Failed to fetch action logs for device: ${deviceId}`,
        error,
      );
      throw new InternalServerErrorException('Failed to fetch action logs');
    }
  }

  private mapActionLog(log: {
    id: string;
    deviceId: string;
    action: string;
    target: string;
    endpoint: string;
    result: string;
    httpStatusCode: number;
    errorMessage: string | null;
    createdAt: Date;
  }): ActionLog {
    return {
      id: log.id,
      deviceId: log.deviceId,
      action: this.parseAction(log.action),
      target: this.parseTarget(log.target),
      endpoint: log.endpoint,
      result: this.parseResult(log.result),
      httpStatusCode: log.httpStatusCode,
      errorMessage: log.errorMessage ?? undefined,
      createdAt: log.createdAt,
    };
  }

  private parseAction(action: string): DeviceAction {
    if (action === 'turn_on' || action === 'turn_off') {
      return action;
    }

    this.logger.error(`Invalid action found in database: ${action}`);
    throw new InternalServerErrorException('Invalid action in database');
  }

  private parseTarget(target: string): DeviceTarget {
    if (target === 'riego' || target === 'luces') {
      return target;
    }

    this.logger.error(`Invalid target found in database: ${target}`);
    throw new InternalServerErrorException('Invalid target in database');
  }

  private parseResult(result: string): ActionResultStatus {
    if (result === 'success' || result === 'failed') {
      return result;
    }

    this.logger.error(`Invalid result found in database: ${result}`);
    throw new InternalServerErrorException('Invalid action result in database');
  }
}
