/**
 * Token lifetime shared by the JwtModule configuration and the login
 * response so the signed JWT and the reported `expiresIn` cannot drift.
 */
export const AUTH_TOKEN_TTL = '12h';
export const AUTH_TOKEN_TTL_SECONDS = 12 * 60 * 60;

export const DEFAULT_AUTH_USERNAME = 'admin';
