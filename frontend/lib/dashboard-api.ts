import {
  type DashboardData,
  type DashboardDevice,
  type DashboardSensors,
  type DashboardWeather,
  type DashboardZone,
  zoneDefinitions,
} from "@/components/dashboard/dashboard-data";
import { getApiBaseUrl } from "@/lib/api-base-url";

type ApiDevice = Readonly<{
  id: string;
  name: string;
  description: string;
  capabilities: string[];
  /** Last successful board sync (ISO string); null until the board reports. */
  lastSeenAt: string | null;
  ipAddress: string | null;
  port: number | null;
  status: "online" | "offline";
}>;

type ApiTelemetryReading = Readonly<{
  id: string;
  ts: string;
  metric: string;
  value: number;
  unit?: string;
  source?: string;
}>;

type TaggedReading = ApiTelemetryReading & Readonly<{ deviceName: string }>;

/** Backend contract for `GET /weather` (normalized OpenWeatherMap snapshot). */
type ApiWeather = Readonly<{
  location: string;
  temperatureC: number;
  description: string;
  icon?: string;
  humidityPct?: number | null;
  fetchedAt: string;
}>;

export type DashboardLoadResult =
  | Readonly<{ status: "ok"; data: DashboardData }>
  | Readonly<{ status: "unauthorized" }>
  | Readonly<{ status: "disconnected" }>;

/** Home location. A fact of this deployment, not a placeholder. */
const LOCATION = "Río Cuarto";

const TELEMETRY_LIMIT = 1000;

/**
 * The backend orders telemetry `ts asc` and then applies `limit`, so a wide
 * window with a small limit returns the OLDEST rows. A 10-minute window keeps
 * the latest readings inside `limit`.
 */
const TELEMETRY_WINDOW_MS = 10 * 60 * 1000;

/**
 * Mirrors the backend liveness threshold (30 s). In push mode every sync
 * refreshes `lastSeenAt`, so its age is the exact liveness signal; `status`
 * is only the fallback for links that never report a timestamp (pull mode).
 */
const DEVICE_ONLINE_WINDOW_MS = 30 * 1000;

type ApiResult<T> =
  | Readonly<{ ok: true; data: T }>
  | Readonly<{ ok: false; unauthorized: boolean }>;

async function fetchApi<T>(token: string, path: string): Promise<ApiResult<T>> {
  try {
    const response = await fetch(`${getApiBaseUrl()}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    if (response.status === 401) {
      return { ok: false, unauthorized: true };
    }

    if (!response.ok) {
      return { ok: false, unauthorized: false };
    }

    return { ok: true, data: (await response.json()) as T };
  } catch {
    return { ok: false, unauthorized: false };
  }
}

function formatAddress(device: ApiDevice): string {
  if (!device.ipAddress) {
    return device.port ? `puerto ${device.port}` : "sin dirección";
  }

  return `${device.ipAddress}:${device.port ?? "-"}`;
}

function formatRelativeSeen(
  lastSeenAt: string | null,
  now: number,
): string {
  if (!lastSeenAt) {
    return "sin sincronizar";
  }

  const lastSeen = Date.parse(lastSeenAt);

  if (!Number.isFinite(lastSeen)) {
    return "sin sincronizar";
  }

  const elapsedSeconds = Math.max(0, Math.round((now - lastSeen) / 1000));

  if (elapsedSeconds < 60) {
    return `visto hace ${elapsedSeconds} s`;
  }

  const elapsedMinutes = Math.round(elapsedSeconds / 60);

  if (elapsedMinutes < 60) {
    return `visto hace ${elapsedMinutes} min`;
  }

  const elapsedHours = Math.round(elapsedMinutes / 60);

  if (elapsedHours < 24) {
    return `visto hace ${elapsedHours} h`;
  }

  return `visto hace ${Math.round(elapsedHours / 24)} d`;
}

function isDeviceOnline(device: ApiDevice, now: number): boolean {
  // `lastSeenAt` wins when present: a stale `status: "online"` left behind by
  // a disabled sweep must not keep a dead board green.
  if (device.lastSeenAt) {
    const lastSeen = Date.parse(device.lastSeenAt);

    return (
      Number.isFinite(lastSeen) && now - lastSeen <= DEVICE_ONLINE_WINDOW_MS
    );
  }

  return device.status === "online";
}

function mapDeviceToCard(device: ApiDevice, now: number): DashboardDevice {
  const isOnline = isDeviceOnline(device, now);

  return {
    id: device.id,
    name: device.name,
    tone: isOnline ? "text-emerald-300" : "text-rose-300",
    statusLabel: isOnline ? "Online 🟢" : "Offline 🔴",
    ipAddress: formatAddress(device),
    lastSeenLabel: formatRelativeSeen(device.lastSeenAt, now),
    capabilities: device.capabilities ?? [],
  };
}

function findDeviceByCapability(
  devices: readonly ApiDevice[],
  capability: string,
): ApiDevice | undefined {
  return devices.find((device) =>
    (device.capabilities ?? []).includes(capability),
  );
}

function mapZonesFromDevices(
  devices: readonly ApiDevice[],
): readonly DashboardZone[] {
  return zoneDefinitions.map((zone) => ({
    ...zone,
    deviceId: findDeviceByCapability(devices, zone.actionTarget)?.id,
  }));
}

function buildStatusLine(devices: readonly ApiDevice[], now: number): string {
  if (devices.length === 0) {
    return "Sin dispositivos registrados";
  }

  const onlineDevices = devices.filter((device) => isDeviceOnline(device, now));

  return `${onlineDevices.length}/${devices.length} dispositivos online`;
}

function findLatestReading<T extends ApiTelemetryReading>(
  readings: readonly T[],
  metric: string,
): T | undefined {
  for (let index = readings.length - 1; index >= 0; index -= 1) {
    const reading = readings[index];
    if (reading?.metric === metric) {
      return reading;
    }
  }

  return undefined;
}

function formatMetricValue(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function buildTelemetryPath(deviceId: string, now: number): string {
  const from = new Date(now - TELEMETRY_WINDOW_MS).toISOString();
  const to = new Date(now).toISOString();
  const query = [
    `from=${encodeURIComponent(from)}`,
    `to=${encodeURIComponent(to)}`,
    `limit=${TELEMETRY_LIMIT}`,
  ].join("&");

  return `/devices/${deviceId}/telemetry?${query}`;
}

/**
 * Reads the window from every device and merges the readings in ascending
 * `ts` order, so the last matching entry really is the newest one.
 */
async function fetchReadings(
  token: string,
  devices: readonly ApiDevice[],
  now: number,
): Promise<readonly TaggedReading[]> {
  const perDevice = await Promise.all(
    devices.map(async (device) => {
      const result = await fetchApi<ApiTelemetryReading[]>(
        token,
        buildTelemetryPath(device.id, now),
      );

      return result.ok
        ? result.data.map((reading) => ({
            ...reading,
            deviceName: device.name,
          }))
        : [];
    }),
  );

  return perDevice
    .flat()
    .sort((left, right) => Date.parse(left.ts) - Date.parse(right.ts));
}

/**
 * Weather is optional: a 503 (provider down or key missing) must degrade to
 * "no weather" instead of taking the whole dashboard down.
 */
function mapWeather(result: ApiResult<ApiWeather>): DashboardWeather | null {
  if (!result.ok) {
    return null;
  }

  return {
    location: result.data.location,
    temperature: `${formatMetricValue(result.data.temperatureC)} °C`,
    description: result.data.description,
  };
}

function mapSensors(readings: readonly TaggedReading[]): DashboardSensors {
  const latestTemperature = findLatestReading(readings, "temperature");
  const latestHumidity = findLatestReading(readings, "humidity");

  return {
    deviceName: latestTemperature?.deviceName ?? latestHumidity?.deviceName,
    temperature:
      latestTemperature !== undefined
        ? `${formatMetricValue(latestTemperature.value)} °C`
        : null,
    humidity:
      latestHumidity !== undefined
        ? `${formatMetricValue(latestHumidity.value)} %`
        : null,
  };
}

export async function getDashboardData(
  token: string,
): Promise<DashboardLoadResult> {
  const devicesResult = await fetchApi<ApiDevice[]>(token, "/devices");

  if (!devicesResult.ok) {
    return devicesResult.unauthorized
      ? { status: "unauthorized" }
      : { status: "disconnected" };
  }

  const devices = devicesResult.data;
  const now = Date.now();
  const [weatherResult, readings] = await Promise.all([
    fetchApi<ApiWeather>(token, "/weather"),
    fetchReadings(token, devices, now),
  ]);

  return {
    status: "ok",
    data: {
      location: LOCATION,
      statusLine: buildStatusLine(devices, now),
      weather: mapWeather(weatherResult),
      sensors: mapSensors(readings),
      zones: mapZonesFromDevices(devices),
      devices: devices.map((device) => mapDeviceToCard(device, now)),
    },
  };
}
