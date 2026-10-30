import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class ExecuteActionDto {
  @IsIn(['turn_on', 'turn_off'])
  action!: 'turn_on' | 'turn_off';

  @IsString()
  @IsNotEmpty()
  target!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(180)
  durationMinutes?: number;
}
