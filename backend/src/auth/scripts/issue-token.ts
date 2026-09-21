import { JwtService } from '@nestjs/jwt';
import type { JwtPayload } from '../interfaces/jwt-payload.interface';
import type { Role } from '../interfaces/role.interface';

export const TOKEN_TTL = '24h';
export const VALID_ROLES: readonly Role[] = ['admin', 'viewer', 'service'];

export const DEFAULT_SUBS: Record<Role, string> = {
  admin: 'admin',
  viewer: 'viewer',
  service: 'n8n-sistema-riego',
};

/** Kept for the n8n docs and the `auth:issue-service` alias. */
export const SERVICE_TOKEN_SUB = DEFAULT_SUBS.service;
export const SERVICE_TOKEN_TTL = TOKEN_TTL;

const USAGE =
  'Usage: npm run auth:issue-token -- --role admin|viewer|service [--sub <subject>]';

export interface IssueTokenOptions {
  role: Role;
  sub?: string;
}

/**
 * Offline JWT issuance for any role. No HTTP endpoint exists on purpose
 * (bootstrapping risk); rotation means re-issuing and updating the consumer
 * credential. Full invalidation via JWT_SECRET rotation.
 */
export function parseIssueTokenArgs(argv: string[]): IssueTokenOptions {
  let role: string | undefined;
  let sub: string | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    const value = argv[index + 1];

    if (flag === '--role' || flag === '--sub') {
      if (value === undefined || value.startsWith('--')) {
        throw new Error(`Missing value for ${flag}\n${USAGE}`);
      }

      if (flag === '--role') {
        role = value;
      } else {
        if (value.trim() === '') {
          throw new Error(`--sub must not be empty\n${USAGE}`);
        }
        sub = value.trim();
      }

      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${flag}\n${USAGE}`);
  }

  if (!role || !VALID_ROLES.includes(role as Role)) {
    throw new Error(
      `--role must be one of: ${VALID_ROLES.join('|')}\n${USAGE}`,
    );
  }

  return { role: role as Role, sub };
}

export function resolveSub(options: IssueTokenOptions): string {
  return options.sub ?? DEFAULT_SUBS[options.role];
}

export async function issueToken(
  secret: string,
  options: IssueTokenOptions,
): Promise<string> {
  const jwtService = new JwtService({
    secret,
    signOptions: { expiresIn: TOKEN_TTL },
  });
  const payload: Pick<JwtPayload, 'sub' | 'role'> = {
    sub: resolveSub(options),
    role: options.role,
  };

  return jwtService.signAsync(payload);
}

export async function issueServiceToken(
  secret: string,
  sub: string = SERVICE_TOKEN_SUB,
): Promise<string> {
  return issueToken(secret, { role: 'service', sub });
}

async function main(): Promise<void> {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.error('JWT_SECRET is not set. Refusing to issue a token.');
    process.exit(1);
  }

  const options = parseIssueTokenArgs(process.argv.slice(2));
  console.log(await issueToken(secret, options));
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
