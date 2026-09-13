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
