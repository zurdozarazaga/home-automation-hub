import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class TelemetryReadingDto {
  @IsDateString()
  ts!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  metric!: string;

  @IsNumber()
  value!: number;

  @IsString()
  @IsOptional()
  @MaxLength(20)
  unit?: string;

  @IsString()
  @IsOptional()
  @MaxLength(60)
  source?: string;
}

export class IngestTelemetryDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => TelemetryReadingDto)
  readings!: TelemetryReadingDto[];
}
