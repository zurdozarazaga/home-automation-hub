/**
 * Normalized current-weather snapshot for the dashboard header.
 *
 * The provider (OpenWeatherMap) is an implementation detail: the frontend
 * only sees this contract, so swapping providers never touches the UI.
 */
export interface WeatherSnapshot {
  /** Deployment label for the location, from WEATHER_CITY. */
  location: string;
  /** Degrees Celsius, rounded to one decimal. */
  temperatureC: number;
  /** Provider description in Spanish, e.g. "cielo claro". */
  description: string;
  /** Provider icon code (e.g. "01d") kept for future UI use. */
  icon: string;
  /** Relative humidity percentage when the provider reports it. */
  humidityPct: number | null;
  /** ISO timestamp of the reading that produced this snapshot. */
  fetchedAt: string;
}
