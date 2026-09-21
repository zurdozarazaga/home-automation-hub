import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { IngestTelemetryDto } from './dto/ingest-telemetry.dto';
import { QueryTelemetryDto } from './dto/query-telemetry.dto';
import {
  TelemetryIngestResult,
  TelemetryReading,
} from './interfaces/telemetry-reading.interface';
import { TelemetryService } from './telemetry.service';

@Controller('devices/:deviceId/telemetry')
export class TelemetryController {
  constructor(private readonly telemetryService: TelemetryService) {}

  @Post('batch')
  @Roles('service')
  async ingestBatch(
    @Param('deviceId', ParseUUIDPipe) deviceId: string,
    @Body() ingestTelemetryDto: IngestTelemetryDto,
  ): Promise<TelemetryIngestResult> {
    return this.telemetryService.ingest(deviceId, ingestTelemetryDto);
  }

  @Get()
  @Roles('admin', 'viewer')
  async query(
    @Param('deviceId', ParseUUIDPipe) deviceId: string,
    @Query() queryTelemetryDto: QueryTelemetryDto,
  ): Promise<TelemetryReading[]> {
    return this.telemetryService.query(deviceId, queryTelemetryDto);
  }
}
