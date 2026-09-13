import { JwtService } from '@nestjs/jwt';
import type { JwtPayload } from '../interfaces/jwt-payload.interface';

export const SERVICE_TOKEN_SUB = 'n8n-sistema-riego';
export const SERVICE_TOKEN_TTL = '24h';

/**
 * Offline service-JWT issuance for the n8n trigger account.
 * No HTTP endpoint exists on purpose (bootstrapping risk); rotation means
 * re-issuing via `npm run auth:issue-service` and updating the n8n
 * credential. Full invalidation via JWT_SECRET rotation.
 */
export async function issueServiceToken(
  secret: string,
  sub: string = SERVICE_TOKEN_SUB,
): Promise<string> {
  const jwtService = new JwtService({
    secret,
    signOptions: { expiresIn: SERVICE_TOKEN_TTL },
  });
  const payload: Pick<JwtPayload, 'sub' | 'role'> = { sub, role: 'service' };
  return jwtService.signAsync(payload);
}

async function main(): Promise<void> {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.error('JWT_SECRET is not set. Refusing to issue a token.');
    process.exit(1);
  }
  const sub = process.argv[2] ?? SERVICE_TOKEN_SUB;
  const token = await issueServiceToken(secret, sub);
  console.log(token);
}

if (require.main === module) {
  void main();
}
