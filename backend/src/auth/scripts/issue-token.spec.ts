import { JwtService } from '@nestjs/jwt';
import type { JwtPayload } from '../interfaces/jwt-payload.interface';
import {
  DEFAULT_SUBS,
  SERVICE_TOKEN_SUB,
  VALID_ROLES,
  issueServiceToken,
  issueToken,
  parseIssueTokenArgs,
} from './issue-token';

const secret = 'issuer-spec-secret';

const verify = (token: string): Promise<JwtPayload> =>
  new JwtService({ secret }).verifyAsync<JwtPayload>(token);

describe('parseIssueTokenArgs', () => {
  it('parses role and optional subject', () => {
    expect(parseIssueTokenArgs(['--role', 'viewer'])).toEqual({
      role: 'viewer',
      sub: undefined,
    });
    expect(parseIssueTokenArgs(['--role', 'admin', '--sub', 'ops'])).toEqual({
      role: 'admin',
      sub: 'ops',
    });
  });

  it('rejects a missing or invalid role', () => {
    expect(() => parseIssueTokenArgs([])).toThrow(/--role must be one of/);
    expect(() => parseIssueTokenArgs(['--role', 'superuser'])).toThrow(
      /--role must be one of/,
    );
  });

  it('rejects unknown flags, missing values and empty subjects', () => {
    expect(() => parseIssueTokenArgs(['--role', 'admin', '--wat'])).toThrow(
      /Unknown argument/,
    );
    expect(() => parseIssueTokenArgs(['--role'])).toThrow(/Missing value/);
    expect(() =>
      parseIssueTokenArgs(['--role', 'admin', '--sub', '  ']),
    ).toThrow(/--sub must not be empty/);
  });

  it('parses --ttl durations and --days sugar', () => {
    expect(parseIssueTokenArgs(['--role', 'service', '--ttl', '720h'])).toEqual(
      { role: 'service', sub: undefined, ttl: '720h' },
    );
    expect(parseIssueTokenArgs(['--role', 'service', '--days', '30'])).toEqual({
      role: 'service',
      sub: undefined,
      ttl: '30d',
    });
  });

  it('rejects invalid or conflicting TTL options', () => {
    expect(() =>
      parseIssueTokenArgs(['--role', 'service', '--ttl', 'forever']),
    ).toThrow(/--ttl must look like/);
    expect(() =>
      parseIssueTokenArgs(['--role', 'service', '--ttl', '0h']),
    ).toThrow(/--ttl must look like/);
    expect(() =>
      parseIssueTokenArgs(['--role', 'service', '--days', '0']),
    ).toThrow(/--days must be a positive integer/);
    expect(() =>
      parseIssueTokenArgs(['--role', 'service', '--days', '1.5']),
    ).toThrow(/--days must be a positive integer/);
    expect(() =>
      parseIssueTokenArgs([
        '--role',
        'service',
        '--ttl',
        '24h',
        '--days',
        '30',
      ]),
    ).toThrow(/mutually exclusive/);
  });
});

describe('issueToken', () => {
  it.each(VALID_ROLES)(
    'mints a %s token with its default subject',
    async (role) => {
      const payload = await verify(await issueToken(secret, { role }));

      expect(payload).toMatchObject({ sub: DEFAULT_SUBS[role], role });
    },
  );

  it('honors an explicit subject', async () => {
    const payload = await verify(
      await issueToken(secret, { role: 'viewer', sub: 'ops-viewer' }),
    );

    expect(payload).toMatchObject({ sub: 'ops-viewer', role: 'viewer' });
  });

  it('defaults to a 24h lifetime', async () => {
    const payload = await verify(await issueToken(secret, { role: 'admin' }));

    expect((payload.exp ?? 0) - (payload.iat ?? 0)).toBe(24 * 60 * 60);
  });

  it('honors a custom ttl', async () => {
    const payload = await verify(
      await issueToken(secret, { role: 'service', ttl: '720h' }),
    );

    expect((payload.exp ?? 0) - (payload.iat ?? 0)).toBe(720 * 60 * 60);
  });
});

describe('issueServiceToken', () => {
  it('still mints the n8n service token for the alias script', async () => {
    const payload = await verify(await issueServiceToken(secret));

    expect(payload).toMatchObject({ sub: SERVICE_TOKEN_SUB, role: 'service' });
  });

  it('accepts a custom subject', async () => {
    const payload = await verify(
      await issueServiceToken(secret, 'custom-service'),
    );

    expect(payload).toMatchObject({ sub: 'custom-service', role: 'service' });
  });
});
