import { Body, Controller, HttpStatus, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ActionsService } from '../../actions/actions.service';
import {
  ActionExecutionResult,
  QueuedActionExecutionResult,
} from '../../actions/interfaces/action.interface';
import { Roles } from '../../auth/decorators/roles.decorator';
import { N8nTriggerActionDto } from './dto/trigger-action.dto';

@Controller('integrations/n8n')
export class N8nController {
  constructor(private readonly actionsService: ActionsService) {}

  @Post('actions')
  @Roles('service')
  async triggerAction(
    @Body() payload: N8nTriggerActionDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ActionExecutionResult | QueuedActionExecutionResult> {
    const result = await this.actionsService.execute(payload.deviceId, payload);

    // Same contract as /devices/:id/actions: push mode queues (202), pull
    // mode keeps the POST default 201.
    if (result.result === 'queued') {
      response.status(HttpStatus.ACCEPTED);
    }

    return result;
  }
}
