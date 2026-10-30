import {
  dashboardDataMock,
  type DashboardData,
  type DashboardDevice,
  type DashboardSensors,
  type DashboardZone,
} from "@/components/dashboard/dashboard-data";
import { getApiBaseUrl } from "@/lib/api-base-url";

type ApiDevice = Readonly<{
  id: string;
  name: string;
  description: string;
  ipAddress: string | null;
  port: number | null;
  status: "online" | "offline";
}>;

type ApiDevicesHealth = Readonly<{
  status: "ok";
  totalDevices: number;
  onlineDevices: number;
  offlineDevices: number;
  checkedAt: string;
}>;

type ApiTelemetryReading = Readonly<{
  id: string;
  ts: string;
  metric: string;
  value: number;
  unit?: string;
  source?: string;
}>;

export type DashboardLoadResult =
  | Readonly<{ status: "ok"; data: DashboardData }>
  | Readonly<{ status: "unauthorized" }>
  | Readonly<{ status: "disconnected" }>;

const TELEMETRY_LIMIT = 500;
const SENSOR_KEYWORDS = ["sensor", "dht", "clima", "ambiente"] as const;
const RIEGO_KEYWORDS = ["riego"] as const;
const LUCES_KEYWORDS = ["luces", "luz", "patio"] as const;

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

function mapDeviceToCard(device: ApiDevice): DashboardDevice {
  const isOnline = device.status === "online";

  return {
    id: device.id,
    name: device.name,
    state: isOnline ? "Online" : "Offline",
    tone: isOnline ? "text-emerald-300" : "text-rose-300",
    statusLabel: isOnline ? "Online 🟢" : "Offline 🔴",
    ipAddress: formatAddress(device),
  };
}

function findDeviceByKeywords(
  devices: readonly ApiDevice[],
  keywords: readonly string[],
): ApiDevice | undefined {
  const normalizedKeywords = keywords.map((keyword) => keyword.toLowerCase());

  return devices.find((device) => {
    const searchable = `${device.name} ${device.description}`.toLowerCase();
    return normalizedKeywords.some((keyword) => searchable.includes(keyword));
  });
}

function zoneKeywords(actionTarget: string): readonly string[] {
  return actionTarget === "riego" ? RIEGO_KEYWORDS : LUCES_KEYWORDS;
}

function mapZonesFromDevices(
  devices: readonly ApiDevice[],
): readonly DashboardZone[] {
  return dashboardDataMock.zones.map((zone) => ({
    ...zone,
    // No mock device ids: an unmatched zone stays unavailable.
    deviceId: findDeviceByKeywords(devices, zoneKeywords(zone.actionTarget))?.id,
  }));
}

function mapForecast(health: ApiDevicesHealth | null): string {
  if (!health) {
    return dashboardDataMock.forecast;
  }

  if (health.offlineDevices > 0) {
    return `${health.offlineDevices} dispositivo(s) offline`;
  }

  return `${health.onlineDevices}/${health.totalDevices} dispositivos online`;
}

function findLatestReading(
  readings: readonly ApiTelemetryReading[],
  metric: string,
): ApiTelemetryReading | undefined {
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

function mapSensors(
  device: ApiDevice | undefined,
  readings: readonly ApiTelemetryReading[] | null,
): DashboardSensors {
  const latestTemperature = readings
    ? findLatestReading(readings, "temperature")
    : undefined;
  const latestHumidity = readings
    ? findLatestReading(readings, "humidity")
    : undefined;

  return {
    deviceName: device?.name,
    temperature: latestTemperature
      ? `${formatMetricValue(latestTemperature.value)} °C`
      : null,
    humidity: latestHumidity
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
  const sensorDevice = findDeviceByKeywords(devices, SENSOR_KEYWORDS) ?? devices[0];

  const [healthResult, telemetryResult] = await Promise.all([
    fetchApi<ApiDevicesHealth>(token, "/health/devices"),
    sensorDevice
      ? fetchApi<ApiTelemetryReading[]>(
          token,
          `/devices/${sensorDevice.id}/telemetry?limit=${TELEMETRY_LIMIT}`,
        )
      : null,
  ]);

  return {
    status: "ok",
    data: {
      ...dashboardDataMock,
      forecast: mapForecast(healthResult.ok ? healthResult.data : null),
      devices: devices.map(mapDeviceToCard),
      zones: mapZonesFromDevices(devices),
      sensors: mapSensors(
        sensorDevice,
        telemetryResult?.ok ? telemetryResult.data : null,
      ),
    },
  };
}
