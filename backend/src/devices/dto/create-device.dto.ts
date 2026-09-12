import {
  IsArray,
  IsIP,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

/**
 * Network address is required for ESP32 (or driver-less) devices and
 * optional for topic-addressed drivers (e.g. MQTT with `mqttTopic`).
 */
function requiresNetworkAddress(object: object): boolean {
  const candidate = object as { driver?: string; mqttTopic?: string };
  return (candidate.driver ?? 'esp32') === 'esp32' || !candidate.mqttTopic;
}

export class CreateDeviceDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  description!: string;

  @IsString()
  @IsOptional()
  @MaxLength(40)
  driver?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  capabilities?: string[];

  @IsString()
  @IsOptional()
  @MaxLength(255)
  mqttTopic?: string;

  @ValidateIf(requiresNetworkAddress)
  @IsIP('4')
  ipAddress?: string;

  @ValidateIf(requiresNetworkAddress)
  @IsInt()
  @Min(1)
  @Max(65535)
  port?: number;
}
