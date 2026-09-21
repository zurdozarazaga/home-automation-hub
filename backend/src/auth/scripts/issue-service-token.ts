import {
  SERVICE_TOKEN_SUB,
  SERVICE_TOKEN_TTL,
  issueServiceToken,
} from './issue-token';

export { SERVICE_TOKEN_SUB, SERVICE_TOKEN_TTL, issueServiceToken };

/**
 * Backwards-compatible entry point for the n8n service token.
 *
 * Docs and the n8n credential reference `npm run auth:issue-service`; new
 * issuance should use `npm run auth:issue-token -- --role <role>`.
 *
 * Usage: npm run auth:issue-service -- [subject]
 */
async function main(): Promise<void> {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.error('JWT_SECRET is not set. Refusing to issue a token.');
    process.exit(1);
  }

  const sub = process.argv[2];
  console.log(await issueServiceToken(secret, sub));
}

if (require.main === module) {
  void main();
}
