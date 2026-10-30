import { ActionLog } from './action.interface';

export interface ActionLogRepository {
  create(log: Omit<ActionLog, 'id'>): Promise<ActionLog>;
  findAllByDeviceId(deviceId: string): Promise<ActionLog[]>;
}
