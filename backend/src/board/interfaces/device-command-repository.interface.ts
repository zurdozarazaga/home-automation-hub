import type { DeviceAction } from '../../actions/interfaces/action.interface';
import type {
  DeviceCommand,
  DeviceCommandResult,
} from './device-command.interface';

export interface CreateDeviceCommandInput {
  deviceId: string;
  action: DeviceAction;
  target: string;
  endpoint?: string;
  createdAt?: Date;
}

export interface AcknowledgeDeviceCommandInput {
  result: DeviceCommandResult;
  errorMessage?: string;
  ackedAt: Date;
}

export interface DeviceCommandRepository {
  create(input: CreateDeviceCommandInput): Promise<DeviceCommand>;
  findById(id: string): Promise<DeviceCommand | null>;
  /**
   * Claims up to `limit` oldest pending commands for the device and marks
   * them dispatched atomically, so two concurrent syncs never return the
   * same command.
   */
  claimPendingByDevice(
    deviceId: string,
    dispatchedAt: Date,
    limit: number,
  ): Promise<DeviceCommand[]>;
  /** Marks a pending/dispatched command acked; null when not claimable. */
  acknowledge(
    id: string,
    input: AcknowledgeDeviceCommandInput,
  ): Promise<DeviceCommand | null>;
  /**
   * Expires pending/dispatched commands whose dispatch reference
   * (dispatchedAt, falling back to createdAt) is older than `cutoff`.
   */
  expireStale(cutoff: Date, errorMessage: string): Promise<DeviceCommand[]>;
}
