import {
  dashboardDataMock,
  type DashboardData,
  type DashboardDevice,
  type DashboardZone,
} from "@/components/dashboard/dashboard-data";

type ApiDevice = Readonly<{
  id: string;
  name: string;
  description: string;
  ipAddress: string;
  port: number;
  status: "online" | "offline";
  createdAt: string;
  updatedAt: string;
}>;

type ApiDevicesHealth = Readonly<{
  status: "ok";
  totalDevices: number;
  onlineDevices: number;
  offlineDevices: number;
  checkedAt: string;
}>;

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || "http://localhost:3001";

async function fetchApi<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as T;
  } catch {
    return null;
  }
}

function mapDeviceToCard(device: ApiDevice): DashboardDevice {
  const isOnline = device.status === "online";

  return {
    id: device.id,
    name: device.name,
    state: isOnline ? "Online" : "Offline",
    tone: isOnline ? "text-emerald-300" : "text-rose-300",
    statusLabel: isOnline ? "Online 🟢" : "Offline 🔴",
    ipAddress: `${device.ipAddress}:${device.port}`,
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

function mapZonesFromDevices(devices: readonly ApiDevice[]): readonly DashboardZone[] {
  const defaultZones = dashboardDataMock.zones;

  return defaultZones.map((zone) => {
    const keywords = zone.actionTarget === "riego"
      ? ["riego"]
      : ["luces", "luz", "patio"];
    const linkedDevice = findDeviceByKeywords(devices, keywords);

    return {
      ...zone,
      deviceId: linkedDevice?.id ?? zone.deviceId,
    };
  });
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

export async function getDashboardData(): Promise<DashboardData> {
  const [devices, devicesHealth] = await Promise.all([
    fetchApi<ApiDevice[]>("/devices"),
    fetchApi<ApiDevicesHealth>("/health/devices"),
  ]);

  if (!devices) {
    return dashboardDataMock;
  }

  return {
    ...dashboardDataMock,
    forecast: mapForecast(devicesHealth),
    devices: devices.map(mapDeviceToCard),
    zones: mapZonesFromDevices(devices),
  };
}
