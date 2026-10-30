import { IsUUID } from 'class-validator';
import { ExecuteActionDto } from '../../../actions/dto/execute-action.dto';

export class N8nTriggerActionDto extends ExecuteActionDto {
  @IsUUID()
  deviceId!: string;
}
