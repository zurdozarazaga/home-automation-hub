import {
  Body,
  Controller,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { Roles } from '../auth/decorators/roles.decorator';
import { ExecuteActionDto } from './dto/execute-action.dto';
import {
  ActionExecutionResult,
  QueuedActionExecutionResult,
} from './interfaces/action.interface';
import { ActionsService } from './actions.service';

@Controller('devices/:deviceId/actions')
export class ActionsController {
  constructor(private readonly actionsService: ActionsService) {}

  @Post()
  @Roles('admin', 'service')
  async execute(
    @Param('deviceId', ParseUUIDPipe) deviceId: string,
    @Body() executeActionDto: ExecuteActionDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ActionExecutionResult | QueuedActionExecutionResult> {
    const result = await this.actionsService.execute(
      deviceId,
      executeActionDto,
    );

    // Push mode answers 202 Accepted while the command waits for the board;
    // pull mode keeps the POST default 201.
    if (result.result === 'queued') {
      response.status(HttpStatus.ACCEPTED);
    }

    return result;
  }
}
