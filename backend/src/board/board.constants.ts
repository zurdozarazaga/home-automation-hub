/** Bounded batch per sync response so one request never returns a huge list. */
export const MAX_PENDING_COMMANDS_PER_SYNC = 20;

/** Error message stored on commands expired by the board sweep. */
export const ACK_TIMEOUT_ERROR_MESSAGE = 'ack timeout';

/** Default sweep cadence; `BOARD_SWEEP_INTERVAL_MS <= 0` disables it. */
export const DEFAULT_BOARD_SWEEP_INTERVAL_MS = 30000;
