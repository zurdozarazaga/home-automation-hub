import { IsIn } from 'class-validator';

export class ExecuteActionDto {
  @IsIn(['turn_on', 'turn_off'])
  action!: 'turn_on' | 'turn_off';

  @IsIn(['riego', 'luces'])
  target!: 'riego' | 'luces';
}
