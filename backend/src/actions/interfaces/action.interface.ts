export type DeviceAction = 'turn_on' | 'turn_off';
/** Driver-declared target; capability-checked against the device at runtime. */
export type DeviceTarget = string;
export type ActionResultStatus = 'success' | 'failed';

export interface ActionCommand {
  deviceId: string;
  action: DeviceAction;
  target: DeviceTarget;
}

export interface ActionLog {
  id: string;
  deviceId: string;
  action: DeviceAction;
  target: DeviceTarget;
  endpoint: string;
  result: ActionResultStatus;
  httpStatusCode: number;
  createdAt: Date;
  errorMessage?: string;
}

export interface ActionExecutionResult {
  deviceId: string;
  action: DeviceAction;
  target: DeviceTarget;
  endpoint: string;
  result: ActionResultStatus;
  httpStatusCode: number;
  executedAt: Date;
}

/**
 * Push-link response: the command was persisted for the board to pick up on
 * its next POST /board/sync. The final outcome (and the ActionLog row)
 * arrives later with the board ack.
 */
export interface QueuedActionExecutionResult {
  deviceId: string;
  action: DeviceAction;
  target: DeviceTarget;
  endpoint: string;
  commandId: string;
  result: 'queued';
  executedAt: Date;
}
