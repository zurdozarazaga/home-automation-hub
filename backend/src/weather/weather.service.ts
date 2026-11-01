import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { WeatherSnapshot } from './interfaces/weather.interface';

const DEFAULT_LATITUDE = '-33.1304';
const DEFAULT_LONGITUDE = '-64.3499';
const DEFAULT_CITY = 'Río Cuarto';
const DEFAULT_CACHE_TTL_MS = 10 * 60 * 1000;
const DEFAULT_TIMEOUT_MS = 5000;
const PROVIDER_URL = 'https://api.openweathermap.org/data/2.5/weather';

interface OpenWeatherResponse {
  main?: { temp?: number; humidity?: number };
  weather?: Array<{ description?: string; icon?: string }>;
}

interface CachedWeather {
  snapshot: WeatherSnapshot;
  expiresAt: number;
}

/**
 * Current weather for the dashboard header, from OpenWeatherMap.
 *
 * The free `data/2.5/weather` endpoint is used on purpose: One Call 3.0
 * requires a paid subscription. One snapshot is cached for ten minutes, so a
 * dashboard refresh never turns into a provider call storm.
 *
 * Failure policy: when the provider misbehaves, a stale snapshot is served if
 * one exists; otherwise the caller gets 503 and the header shows "—". The API
 * key is never logged and never included in an error message.
 */
@Injectable()
export class WeatherService {
  private readonly logger = new Logger(WeatherService.name);
  private cached: CachedWeather | null = null;

  async getCurrent(): Promise<WeatherSnapshot> {
    const now = Date.now();

    if (this.cached && this.cached.expiresAt > now) {
      return this.cached.snapshot;
    }

    const apiKey = process.env.OPENWEATHER_API_KEY?.trim();

    if (!apiKey) {
      throw new ServiceUnavailableException('Weather is not configured');
    }

    const snapshot = await this.fetchSnapshot(apiKey, now);

    this.cached = {
      snapshot,
      expiresAt:
        now +
        this.resolvePositive('WEATHER_CACHE_TTL_MS', DEFAULT_CACHE_TTL_MS),
    };

    return snapshot;
  }

  private async fetchSnapshot(
    apiKey: string,
    now: number,
  ): Promise<WeatherSnapshot> {
    const url = new URL(PROVIDER_URL);
    url.searchParams.set(
      'lat',
      this.resolveCoordinate('WEATHER_LAT', DEFAULT_LATITUDE),
    );
    url.searchParams.set(
      'lon',
      this.resolveCoordinate('WEATHER_LON', DEFAULT_LONGITUDE),
    );
    url.searchParams.set('units', 'metric');
    url.searchParams.set('lang', 'es');
    url.searchParams.set('appid', apiKey);

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.resolvePositive('WEATHER_TIMEOUT_MS', DEFAULT_TIMEOUT_MS),
    );

    let response: Response;

    try {
      response = await fetch(url, {
        signal: controller.signal,
        cache: 'no-store',
      });
    } catch (error) {
      // Never log the URL: it carries the API key.
      this.logger.warn(
        `Weather provider request failed (${error instanceof Error ? error.name : 'unknown'})`,
      );
      return this.staleOrThrow();
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      this.logger.warn(`Weather provider responded ${response.status}`);
      return this.staleOrThrow();
    }

    const body = (await response
      .json()
      .catch(() => null)) as OpenWeatherResponse | null;
    const snapshot = this.mapResponse(body, now);

    if (!snapshot) {
      this.logger.warn('Weather provider returned an unexpected payload');
      return this.staleOrThrow();
    }

    return snapshot;
  }

  private mapResponse(
    body: OpenWeatherResponse | null,
    now: number,
  ): WeatherSnapshot | null {
    const temperature = body?.main?.temp;
    const description = body?.weather?.[0]?.description;

    if (typeof temperature !== 'number' || !Number.isFinite(temperature)) {
      return null;
    }

    if (typeof description !== 'string' || description.trim() === '') {
      return null;
    }

    return {
      location: this.resolveCity(),
      temperatureC: Math.round(temperature * 10) / 10,
      description: description.trim(),
      icon: body?.weather?.[0]?.icon ?? '',
      humidityPct:
        typeof body?.main?.humidity === 'number' ? body.main.humidity : null,
      fetchedAt: new Date(now).toISOString(),
    };
  }

  /** Serves the last good snapshot instead of failing on a provider hiccup. */
  private staleOrThrow(): WeatherSnapshot {
    if (this.cached) {
      return this.cached.snapshot;
    }

    throw new ServiceUnavailableException('Weather provider unavailable');
  }

  private resolveCity(): string {
    return process.env.WEATHER_CITY?.trim() || DEFAULT_CITY;
  }

  /** Coordinates are validated so a typo falls back instead of breaking OWM. */
  private resolveCoordinate(name: string, fallback: string): string {
    const raw = process.env[name]?.trim();

    if (!raw || !Number.isFinite(Number(raw))) {
      return fallback;
    }

    return raw;
  }

  private resolvePositive(name: string, fallback: number): number {
    const raw = process.env[name]?.trim();

    if (!raw) {
      return fallback;
    }

    const value = Number(raw);

    return Number.isFinite(value) && value > 0 ? value : fallback;
  }
}
