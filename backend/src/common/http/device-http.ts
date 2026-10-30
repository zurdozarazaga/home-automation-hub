export const DEFAULT_DEVICE_HTTP_TIMEOUT_MS = 5000;

/**
 * Timeout for backend -> ESP32 HTTP calls (commands and GET /estado).
 *
 * Boards answer fast when reachable; a hanging socket must surface as 502
 * instead of holding the request open. Shared by the command transport and
 * the device poller so both enforce the same bound.
 */
export function resolveDeviceHttpTimeoutMs(): number {
  const raw = process.env.ESP32_HTTP_TIMEOUT_MS;

  if (raw === undefined || raw.trim() === '') {
    return DEFAULT_DEVICE_HTTP_TIMEOUT_MS;
  }

  const timeoutMs = Number(raw);

  return Number.isFinite(timeoutMs) && timeoutMs > 0
    ? timeoutMs
    : DEFAULT_DEVICE_HTTP_TIMEOUT_MS;
}
