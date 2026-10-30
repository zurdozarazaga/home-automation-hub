/**
 * Board link direction.
 *
 * `pull` (default): the backend polls GET /estado and pushes commands over
 * HTTP to the board on the LAN.
 * `push`: the board reaches out to POST /board/sync with its state and acks,
 * and picks up pending commands in the response. Required when the hub runs
 * outside the board's network (e.g. a VPS).
 */
export type DeviceLinkMode = 'pull' | 'push';

export const DEFAULT_DEVICE_LINK_MODE: DeviceLinkMode = 'pull';

/**
 * A board is considered offline when it has not synced within this window.
 * Shared by the action queueing path (502 contract for n8n) and the sweep
 * that flips stale devices offline.
 */
export const DEVICE_OFFLINE_THRESHOLD_MS = 30000;

/**
 * Commands left pending/dispatched longer than this are expired by the
 * board sweep and logged as failed ("ack timeout").
 */
export const COMMAND_ACK_TIMEOUT_MS = 120000;

/**
 * Read on every call on purpose: e2e specs flip the env per suite and the
 * mode must never be cached at import time.
 */
export function resolveDeviceLinkMode(): DeviceLinkMode {
  return process.env.DEVICE_LINK_MODE === 'push' ? 'push' : 'pull';
}

export function isPushLinkMode(): boolean {
  return resolveDeviceLinkMode() === 'push';
}
