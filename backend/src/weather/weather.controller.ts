import { Controller, Get } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import type { WeatherSnapshot } from './interfaces/weather.interface';
import { WeatherService } from './weather.service';

/**
 * Dashboard-only weather. Not public: it is proxied server-side by the
 * frontend with the session token, never called by the browser directly.
 */
@Controller('weather')
export class WeatherController {
  constructor(private readonly weatherService: WeatherService) {}

  @Get()
  @Roles('admin', 'viewer')
  async current(): Promise<WeatherSnapshot> {
    return this.weatherService.getCurrent();
  }
}
