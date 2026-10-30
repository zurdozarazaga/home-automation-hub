import type { DeviceAction } from '../../actions/interfaces/action.interface';

/** Minimal command shape the board needs to execute a queued action. */
export interface BoardCommandSummary {
  id: string;
  action: DeviceAction;
  target: string;
}

export interface BoardSyncResponse {
  deviceId: string;
  commands: BoardCommandSummary[];
}
