import { JwtService } from '@nestjs/jwt';
import type { JwtSignOptions } from '@nestjs/jwt';
import type { JwtPayload } from '../interfaces/jwt-payload.interface';
import type { Role } from '../interfaces/role.interface';

export const TOKEN_TTL = '24h';
export const VALID_ROLES: readonly Role[] = ['admin', 'viewer', 'service'];

/** jsonwebtoken-style duration: 30s, 45m, 72h, 30d. */
const TOKEN_TTL_PATTERN = /^[1-9]\d*(s|m|h|d)$/;

export const DEFAULT_SUBS: Record<Role, string> = {
  admin: 'admin',
  viewer: 'viewer',
  service: 'n8n-sistema-riego',
};

/** Kept for the n8n docs and the `auth:issue-service` alias. */
export const SERVICE_TOKEN_SUB = DEFAULT_SUBS.service;
export const SERVICE_TOKEN_TTL = TOKEN_TTL;

const USAGE =
  'Usage: npm run auth:issue-token -- --role admin|viewer|service [--sub <subject>] [--ttl <duration> | --days <n>]';

export interface IssueTokenOptions {
  role: Role;
  sub?: string;
  /**
   * Token lifetime in jsonwebtoken notation (`720h`, `30d`). Defaults to
   * TOKEN_TTL (24h); `--days <n>` is sugar for `<n>d`. Useful for board and
   * n8n service tokens that must survive long deployments.
   */
  ttl?: string;
}

/**
 * Offline JWT issuance for any role. No HTTP endpoint exists on purpose
 * (bootstrapping risk); rotation means re-issuing and updating the consumer
 * credential. Full invalidation via JWT_SECRET rotation.
 */
export function parseIssueTokenArgs(argv: string[]): IssueTokenOptions {
  let role: string | undefined;
  let sub: string | undefined;
  let ttl: string | undefined;
  let days: string | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    const value = argv[index + 1];

    if (
      flag === '--role' ||
      flag === '--sub' ||
      flag === '--ttl' ||
      flag === '--days'
    ) {
      if (value === undefined || value.startsWith('--')) {
        throw new Error(`Missing value for ${flag}\n${USAGE}`);
      }

      if (flag === '--role') {
        role = value;
      } else if (flag === '--sub') {
        if (value.trim() === '') {
          throw new Error(`--sub must not be empty\n${USAGE}`);
        }
        sub = value.trim();
      } else if (flag === '--ttl') {
        const candidate = value.trim();

        if (!TOKEN_TTL_PATTERN.test(candidate)) {
          throw new Error(
            `--ttl must look like 72h, 30d, 45m or 30s\n${USAGE}`,
          );
        }
        ttl = candidate;
      } else {
        const parsedDays = Number(value);

        if (!Number.isInteger(parsedDays) || parsedDays < 1) {
          throw new Error(`--days must be a positive integer\n${USAGE}`);
        }
        days = value.trim();
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

  if (ttl !== undefined && days !== undefined) {
    throw new Error(`--ttl and --days are mutually exclusive\n${USAGE}`);
  }

  return {
    role: role as Role,
    sub,
    ttl: ttl ?? (days !== undefined ? `${days}d` : undefined),
  };
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
    signOptions: {
      // Validated in parseIssueTokenArgs; the string type is wider than
      // jsonwebtoken's StringValue template literal.
      expiresIn: (options.ttl ?? TOKEN_TTL) as JwtSignOptions['expiresIn'],
    },
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
