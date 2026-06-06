import { Injectable } from '@nestjs/common';
import { ExecuteActionDto } from '../../actions/dto/execute-action.dto';
import { ActionExecutionResult } from '../../actions/interfaces/action.interface';

@Injectable()
export class N8nService {
  // TODO(n8n): Implement real dispatch to ActionsService once:
  //   1. The 'service' role exists in backend/src/auth/interfaces/role.interface.ts
  //   2. RolesGuard extracts the role from the verified JWT
  //   3. A JWT issuance flow exists for the n8n service account
  // Until then this is a placeholder that returns null so the controller
  // can stay wired without doing anything unsafe.
  notImplemented(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _payload: ExecuteActionDto,
  ): Promise<ActionExecutionResult | null> {
    return Promise.resolve(null);
  }
}
