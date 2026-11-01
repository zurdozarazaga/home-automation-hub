import { getApiBaseUrl } from "@/lib/api-base-url";

/** httpOnly cookie that carries the backend access token on local HTTP. */
export const SESSION_COOKIE = "hub_token";

/**
 * Hardened cookie name used over HTTPS.
 *
 * The `__Host-` prefix is enforced by browsers: the cookie is only accepted
 * with `Secure`, `Path=/` and no `Domain`, which pins it to this exact origin.
 */
export const SESSION_COOKIE_SECURE = "__Host-hub_token";

/** Fallback max-age (in seconds) when the backend omits `expiresIn`. */
export const SESSION_MAX_AGE_SECONDS = 24 * 60 * 60;

/** Cookie name for the current scheme: hardened over HTTPS, plain on HTTP. */
export function sessionCookieName(isSecure: boolean): string {
  return isSecure ? SESSION_COOKIE_SECURE : SESSION_COOKIE;
}

type CookieReader = Readonly<{
  get(name: string): Readonly<{ value: string }> | undefined;
}>;

function cookieToken(store: CookieReader, name: string): string | undefined {
  const value = store.get(name)?.value;

  return value ? value : undefined;
}

/**
 * Reads the session token from the cookie store.
 *
 * The `__Host-` name is checked first, then the plain one so a session created
 * over HTTP (local dev) keeps working after an upgrade to HTTPS.
 */
export function readSessionToken(store: CookieReader): string | undefined {
  return (
    cookieToken(store, SESSION_COOKIE_SECURE) ?? cookieToken(store, SESSION_COOKIE)
  );
}

/**
 * True only when the backend explicitly rejects the token (401).
 *
 * A network failure is not a rejection: the dashboard shows its explicit
 * disconnected state instead of bouncing the user back to the login form.
 */
export async function isSessionRejected(token: string): Promise<boolean> {
  try {
    const response = await fetch(`${getApiBaseUrl()}/devices`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    return response.status === 401;
  } catch {
    return false;
  }
}
