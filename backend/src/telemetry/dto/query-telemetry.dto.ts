import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class QueryTelemetryDto {
  @IsString()
  @IsOptional()
  @MaxLength(60)
  metric?: string;

  @IsDateString()
  @IsOptional()
  from?: string;

  @IsDateString()
  @IsOptional()
  to?: string;

  @IsInt()
  @Min(1)
  @Max(1000)
  @IsOptional()
  limit?: number;
}
