import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { ActionLogRepository } from '../interfaces/action-log-repository.interface';
import { ActionLog } from '../interfaces/action.interface';

@Injectable()
export class InMemoryActionLogRepository implements ActionLogRepository {
  private readonly logs = new Map<string, ActionLog>();

  create(log: Omit<ActionLog, 'id'>): Promise<ActionLog> {
    const persistedLog: ActionLog = {
      id: randomUUID(),
      ...log,
    };

    this.logs.set(persistedLog.id, persistedLog);
    return Promise.resolve(persistedLog);
  }

  findAllByDeviceId(deviceId: string): Promise<ActionLog[]> {
    const logs = Array.from(this.logs.values()).filter(
      (log) => log.deviceId === deviceId,
    );

    return Promise.resolve(logs);
  }
}
