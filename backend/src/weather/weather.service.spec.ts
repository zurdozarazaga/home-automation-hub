import { ServiceUnavailableException } from '@nestjs/common';
import { WeatherService } from './weather.service';

const NOW = new Date('2026-11-01T12:00:00.000Z');

const validBody = {
  main: { temp: 22.34, humidity: 61 },
  weather: [{ description: 'cielo claro', icon: '01d' }],
};

function providerResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

describe('WeatherService', () => {
  let fetchMock: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
    process.env.OPENWEATHER_API_KEY = 'test-key';
    delete process.env.WEATHER_LAT;
    delete process.env.WEATHER_LON;
    delete process.env.WEATHER_CITY;
    delete process.env.WEATHER_CACHE_TTL_MS;
    delete process.env.WEATHER_TIMEOUT_MS;
    fetchMock = jest.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    delete process.env.OPENWEATHER_API_KEY;
    delete process.env.WEATHER_LAT;
    delete process.env.WEATHER_LON;
    delete process.env.WEATHER_CITY;
    delete process.env.WEATHER_CACHE_TTL_MS;
    delete process.env.WEATHER_TIMEOUT_MS;
  });

  it('maps a provider snapshot to the dashboard contract', async () => {
    fetchMock.mockResolvedValue(providerResponse(validBody));

    const snapshot = await new WeatherService().getCurrent();

    expect(snapshot).toEqual({
      location: 'Río Cuarto',
      temperatureC: 22.3,
      description: 'cielo claro',
      icon: '01d',
      humidityPct: 61,
      fetchedAt: NOW.toISOString(),
    });

    const requestedUrl = String(fetchMock.mock.calls[0][0]);
    expect(requestedUrl).toContain('lat=-33.1304');
    expect(requestedUrl).toContain('lon=-64.3499');
    expect(requestedUrl).toContain('units=metric');
    expect(requestedUrl).toContain('lang=es');
  });

  it('caches the snapshot for ten minutes', async () => {
    fetchMock.mockResolvedValue(providerResponse(validBody));
    const service = new WeatherService();

    const first = await service.getCurrent();
    const second = await service.getCurrent();

    expect(second).toBe(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('fetches again once the cache window expired', async () => {
    fetchMock.mockResolvedValue(providerResponse(validBody));
    const service = new WeatherService();

    await service.getCurrent();
    jest.setSystemTime(new Date(NOW.getTime() + 10 * 60 * 1000 + 1));
    await service.getCurrent();

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('fails with 503 when the API key is not configured', async () => {
    delete process.env.OPENWEATHER_API_KEY;

    await expect(new WeatherService().getCurrent()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fails with 503 when the provider errors and nothing is cached', async () => {
    fetchMock.mockResolvedValue(providerResponse({}, 500));

    await expect(new WeatherService().getCurrent()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('serves the stale snapshot when the provider fails later', async () => {
    fetchMock.mockResolvedValueOnce(providerResponse(validBody));
    const service = new WeatherService();
    const fresh = await service.getCurrent();

    jest.setSystemTime(new Date(NOW.getTime() + 60 * 60 * 1000));
    fetchMock.mockResolvedValueOnce(providerResponse({}, 500));

    await expect(service.getCurrent()).resolves.toBe(fresh);
  });

  it('fails with 503 when the payload is unusable', async () => {
    fetchMock.mockResolvedValue(providerResponse({ main: {} }));

    await expect(new WeatherService().getCurrent()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('fails with 503 when the network call rejects', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));

    await expect(new WeatherService().getCurrent()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('honours the location and coordinate overrides', async () => {
    process.env.WEATHER_CITY = 'Test City';
    process.env.WEATHER_LAT = '-1.5';
    process.env.WEATHER_LON = '2.5';
    fetchMock.mockResolvedValue(providerResponse(validBody));

    const snapshot = await new WeatherService().getCurrent();

    expect(snapshot.location).toBe('Test City');
    const requestedUrl = String(fetchMock.mock.calls[0][0]);
    expect(requestedUrl).toContain('lat=-1.5');
    expect(requestedUrl).toContain('lon=2.5');
  });
});
