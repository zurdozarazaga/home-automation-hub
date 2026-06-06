import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ActionsService } from '../../actions/actions.service';
import { ExecuteActionDto } from '../../actions/dto/execute-action.dto';
import { ActionExecutionResult } from '../../actions/interfaces/action.interface';
import { N8nService } from './n8n.service';

// TODO(auth): Protect this controller with the 'service' role once the
// RolesGuard extracts roles from a real JWT payload. Until then this
// endpoint is unauthenticated by design — DO NOT expose publicly without
// finishing the auth work in `backend/src/auth/`.
@Controller('integrations/n8n')
export class N8nController {
  constructor(
    private readonly n8nService: N8nService,
    private readonly actionsService: ActionsService,
  ) {}

  // TODO(n8n): Wire this to ActionsService.execute(deviceId, dto) once the
  // n8n workflow starts calling this endpoint instead of publishing to MQTT.
  // Until then the handler returns 501 so the route exists but is inert.
  @Post('actions')
  @HttpCode(501)
  async triggerAction(
    @Body() payload: ExecuteActionDto,
  ): Promise<ActionExecutionResult | null> {
    return this.n8nService.notImplemented(payload);
  }
}
