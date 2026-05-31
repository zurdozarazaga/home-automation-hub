import {
  IsIP,
  IsInt,
  IsNotEmpty,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateDeviceDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  description!: string;

  @IsIP('4')
  ipAddress!: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  port!: number;
}
