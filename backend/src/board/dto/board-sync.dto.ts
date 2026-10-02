import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

/** MAC address in colon or dash notation, any case. */
export const MAC_ADDRESS_PATTERN = /^[0-9A-Fa-f]{2}([:-][0-9A-Fa-f]{2}){5}$/;

export class BoardSensorsDto {
  @IsOptional()
  @IsNumber()
  temperature_c?: number | null;

  @IsOptional()
  @IsNumber()
  humidity_pct?: number | null;

  @IsBoolean()
  valid!: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  age_s?: number | null;
}

export class BoardAckDto {
  @IsUUID()
  id!: string;

  @IsBoolean()
  ok!: boolean;

  @IsOptional()
  @IsInt()
  httpStatus?: number;
}

/**
 * Board -> hub heartbeat (push link). The board reports its identity, its
 * relay/sensor snapshot and the acks of previously dispatched commands;
 * the response carries the commands it must execute next.
 */
export class BoardSyncDto {
  @IsString()
  @Matches(MAC_ADDRESS_PATTERN, {
    message: 'mac must be a MAC address like C0:4E:30:07:DE:10',
  })
  mac!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  fw?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  uptime_s?: number;

  @IsOptional()
  @IsNumber()
  rssi_dbm?: number;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  reset_reason?: string;

  @IsOptional()
  @IsObject()
  relays?: Record<string, string>;

  @IsOptional()
  @ValidateNested()
  @Type(() => BoardSensorsDto)
  sensors?: BoardSensorsDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BoardAckDto)
  acks?: BoardAckDto[];
}
