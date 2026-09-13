import { Body, Controller, Post } from '@nestjs/common';
import { ActionsService } from '../../actions/actions.service';
import { ActionExecutionResult } from '../../actions/interfaces/action.interface';
import { Roles } from '../../auth/decorators/roles.decorator';
import { N8nTriggerActionDto } from './dto/trigger-action.dto';

@Controller('integrations/n8n')
export class N8nController {
  constructor(private readonly actionsService: ActionsService) {}

  @Post('actions')
  @Roles('service')
  async triggerAction(
    @Body() payload: N8nTriggerActionDto,
  ): Promise<ActionExecutionResult> {
    return this.actionsService.execute(payload.deviceId, payload);
  }
}
