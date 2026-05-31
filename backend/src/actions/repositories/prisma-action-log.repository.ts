import { Injectable, NotImplementedException } from '@nestjs/common';
import { ActionLogRepository } from '../interfaces/action-log-repository.interface';
import { ActionLog } from '../interfaces/action.interface';

@Injectable()
export class PrismaActionLogRepository implements ActionLogRepository {
  create(log: Omit<ActionLog, 'id'>): Promise<ActionLog> {
    void log;
    // TODO(prisma): Persist action logs with Prisma action_logs model.
    throw new NotImplementedException(
      'PrismaActionLogRepository is not implemented yet. Use DATA_SOURCE=in-memory.',
    );
  }

  findAllByDeviceId(deviceId: string): Promise<ActionLog[]> {
    void deviceId;
    // TODO(prisma): Query action logs by deviceId with Prisma.
    throw new NotImplementedException(
      'PrismaActionLogRepository is not implemented yet. Use DATA_SOURCE=in-memory.',
    );
  }
}
