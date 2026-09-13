import { IsIn, IsNotEmpty, IsString } from 'class-validator';

export class ExecuteActionDto {
  @IsIn(['turn_on', 'turn_off'])
  action!: 'turn_on' | 'turn_off';

  @IsString()
  @IsNotEmpty()
  target!: string;
}
