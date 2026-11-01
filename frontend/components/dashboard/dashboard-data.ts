export type DashboardZone = Readonly<{
  icon: string;
  name: string;
  accent: string;
  // Widened: the backend capability-checks driver-declared targets at runtime.
  actionTarget: string;
  /** First device whose capabilities include `actionTarget`; absent when none. */
  deviceId?: string;
}>;

export type DashboardDevice = Readonly<{
  id: string;
  name: string;
  tone: string;
  statusLabel: string;
  ipAddress: string;
  /** Relative Spanish sync age, e.g. "visto hace 12 s" / "sin sincronizar". */
  lastSeenLabel: string;
  capabilities: readonly string[];
}>;

export type DashboardSensors = Readonly<{
  deviceName?: string;
  /** Formatted latest reading, e.g. "22.8 °C"; null when there is no data. */
  temperature: string | null;
  /** Formatted latest reading, e.g. "48.5 %"; null when there is no data. */
  humidity: string | null;
}>;

export type DashboardWeather = Readonly<{
  /** Deployment label, e.g. "Río Cuarto". */
  location: string;
  /** Formatted provider temperature, e.g. "22.4 °C". */
  temperature: string;
  /** Provider description in Spanish, e.g. "cielo claro". */
  description: string;
}>;

export type DashboardData = Readonly<{
  location: string;
  /** Real liveness summary, e.g. "1/1 dispositivos online". */
  statusLine: string;
  /** Outdoor weather from the backend; null when the provider is unavailable. */
  weather: DashboardWeather | null;
  sensors: DashboardSensors;
  zones: readonly DashboardZone[];
  devices: readonly DashboardDevice[];
}>;

/**
 * Display config for the zones the dashboard can drive.
 *
 * Only presentation lives here: whether a zone is usable is decided by the
 * device capabilities returned by the backend, never by a name guess.
 */
export const zoneDefinitions: readonly DashboardZone[] = [
  {
    icon: "🌱",
    name: "Riego",
    accent: "from-emerald-400/35 via-cyan-400/10 to-transparent",
    actionTarget: "riego",
  },
  {
    icon: "💡",
    name: "Luces Patio",
    accent: "from-amber-300/35 via-orange-300/10 to-transparent",
    actionTarget: "luces",
  },
];
