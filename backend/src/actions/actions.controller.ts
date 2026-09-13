import { Body, Controller, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ExecuteActionDto } from './dto/execute-action.dto';
import { ActionExecutionResult } from './interfaces/action.interface';
import { ActionsService } from './actions.service';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('devices/:deviceId/actions')
export class ActionsController {
  constructor(private readonly actionsService: ActionsService) {}

  @Post()
  @Roles('admin', 'service')
  async execute(
    @Param('deviceId', ParseUUIDPipe) deviceId: string,
    @Body() executeActionDto: ExecuteActionDto,
  ): Promise<ActionExecutionResult> {
    return this.actionsService.execute(deviceId, executeActionDto);
  }
}
