import type { DeviceCommandStatus } from '../interfaces/device-command.interface';

export const DEVICE_COMMAND_STATUSES: readonly DeviceCommandStatus[] = [
  'pending',
  'dispatched',
  'acked',
  'failed',
  'expired',
];
