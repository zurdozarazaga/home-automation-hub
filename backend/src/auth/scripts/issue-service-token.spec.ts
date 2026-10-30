import { JwtService } from '@nestjs/jwt';
import type { JwtPayload } from '../interfaces/jwt-payload.interface';
import { SERVICE_TOKEN_SUB, issueServiceToken } from './issue-service-token';

describe('issueServiceToken', () => {
  it('mints a service token verifiable by JwtService', async () => {
    const secret = 'rotation-spec-secret';
    const token = await issueServiceToken(secret);

    const payload = await new JwtService({ secret }).verifyAsync<JwtPayload>(
      token,
    );
    expect(payload).toMatchObject({ sub: SERVICE_TOKEN_SUB, role: 'service' });
  });
});
