import {
  IsArray,
  IsIn,
  IsIP,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

/**
 * Same conditional network rules as creation, evaluated against the
 * fields present in the payload. Absent fields stay untouched.
 */
function requiresNetworkAddress(object: object): boolean {
  const candidate = object as { driver?: string; mqttTopic?: string };
  return (candidate.driver ?? 'esp32') === 'esp32' || !candidate.mqttTopic;
}

export class UpdateDeviceDto {
  @IsString()
  @IsOptional()
  @MaxLength(120)
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

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
  @IsOptional()
  ipAddress?: string;

  @ValidateIf(requiresNetworkAddress)
  @IsInt()
  @Min(1)
  @Max(65535)
  @IsOptional()
  port?: number;

  @IsIn(['online', 'offline'])
  @IsOptional()
  status?: 'online' | 'offline';
}
