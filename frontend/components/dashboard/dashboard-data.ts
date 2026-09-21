export type DashboardZone = Readonly<{
  icon: string;
  name: string;
  status: string;
  statusTone: string;
  accent: string;
  // Widened: the backend capability-checks driver-declared targets at runtime.
  actionTarget: string;
  deviceId?: string;
}>;

export type DashboardDevice = Readonly<{
  id: string;
  name: string;
  state: string;
  tone: string;
  statusLabel: string;
  ipAddress: string;
}>;

export type DashboardSensors = Readonly<{
  deviceName?: string;
  /** Formatted latest reading, e.g. "22.8 °C"; null when there is no data. */
  temperature: string | null;
  /** Formatted latest reading, e.g. "48.5 %"; null when there is no data. */
  humidity: string | null;
}>;

export type DashboardData = Readonly<{
  location: string;
  temperature: string;
  forecast: string;
  irrigationSchedule: string;
  irrigationStatus: string;
  sensors: DashboardSensors;
  zones: readonly DashboardZone[];
  devices: readonly DashboardDevice[];
  activity: readonly Readonly<{ time: string; label: string }>[];
  places: readonly string[];
}>;

/**
 * Static copy for data the backend does not expose yet: weather placeholders
 * (header), irrigation automation, activity feed and places. Devices, zones
 * and sensors always come from the API.
 */
export const dashboardDataMock: DashboardData = {
  location: "Buenos Aires",
  temperature: "26°C",
  forecast: "No rain expected",
  irrigationSchedule: "07:00",
  irrigationStatus: "Activo",
  sensors: {
    temperature: null,
    humidity: null,
  },
  zones: [
    {
      icon: "🌱",
      name: "Riego",
      status: "OFF",
      statusTone: "text-rose-200 bg-rose-500/15 border-rose-500/20",
      accent: "from-emerald-400/35 via-cyan-400/10 to-transparent",
      actionTarget: "riego",
    },
    {
      icon: "💡",
      name: "Luces Patio",
      status: "ON",
      statusTone: "text-emerald-200 bg-emerald-500/15 border-emerald-500/20",
      accent: "from-amber-300/35 via-orange-300/10 to-transparent",
      actionTarget: "luces",
    },
  ],
  devices: [],
  activity: [
    { time: "19:00", label: "Riego ON" },
    { time: "19:20", label: "Riego OFF" },
    { time: "20:10", label: "Luces Patio ON" },
  ],
  places: ["Casa", "Jardín", "Patio"],
};
