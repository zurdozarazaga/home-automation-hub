import type { DeviceAction } from '../../actions/interfaces/action.interface';

/**
 * Persisted lifecycle of a board command in push mode:
 * - `pending`: queued by the backend, waiting for the board to pick it up.
 * - `dispatched`: handed to the board in a sync response, waiting for the ack.
 * - `acked`: the board reported the outcome (see `result`).
 * - `expired`: never acked within COMMAND_ACK_TIMEOUT_MS.
 * - `failed`: reserved for transport-level rejections; acks with ok=false
 *   stay `acked` with result `failed`, matching the design contract.
 */
export type DeviceCommandStatus =
  | 'pending'
  | 'dispatched'
  | 'acked'
  | 'failed'
  | 'expired';

export type DeviceCommandResult = 'success' | 'failed';

export interface DeviceCommand {
  id: string;
  deviceId: string;
  action: DeviceAction;
  target: string;
  endpoint?: string;
  status: DeviceCommandStatus;
  result?: DeviceCommandResult;
  errorMessage?: string;
  createdAt: Date;
  dispatchedAt?: Date;
  ackedAt?: Date;
}
