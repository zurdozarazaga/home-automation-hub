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

export type DashboardData = Readonly<{
  location: string;
  temperature: string;
  forecast: string;
  sensorTemperature: string;
  irrigationSchedule: string;
  irrigationStatus: string;
  zones: readonly DashboardZone[];
  devices: readonly DashboardDevice[];
  activity: readonly Readonly<{ time: string; label: string }>[];
  places: readonly string[];
}>;

export const dashboardDataMock: DashboardData = {
  location: "Buenos Aires",
  temperature: "26°C",
  forecast: "No rain expected",
  sensorTemperature: "27°C",
  irrigationSchedule: "07:00",
  irrigationStatus: "Activo",
  zones: [
    {
      icon: "🌱",
      name: "Riego",
      status: "OFF",
      statusTone: "text-rose-200 bg-rose-500/15 border-rose-500/20",
      accent: "from-emerald-400/35 via-cyan-400/10 to-transparent",
      actionTarget: "riego",
      deviceId: "mock-device-riego",
    },
    {
      icon: "💡",
      name: "Luces Patio",
      status: "ON",
      statusTone: "text-emerald-200 bg-emerald-500/15 border-emerald-500/20",
      accent: "from-amber-300/35 via-orange-300/10 to-transparent",
      actionTarget: "luces",
      deviceId: "mock-device-luces",
    },
  ],
  devices: [
    {
      id: "mock-device-riego",
      name: "ESP32 Riego",
      state: "Online",
      tone: "text-emerald-300",
      statusLabel: "Online 🟢",
      ipAddress: "192.168.0.50:80",
    },
    {
      id: "mock-device-luces",
      name: "ESP32 Luces",
      state: "Online",
      tone: "text-emerald-300",
      statusLabel: "Online 🟢",
      ipAddress: "192.168.0.51:80",
    },
  ],
  activity: [
    { time: "19:00", label: "Riego ON" },
    { time: "19:20", label: "Riego OFF" },
    { time: "20:10", label: "Luces Patio ON" },
  ],
  places: ["Casa", "Jardín", "Patio"],
};
