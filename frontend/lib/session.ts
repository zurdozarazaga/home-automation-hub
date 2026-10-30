import { getApiBaseUrl } from "@/lib/api-base-url";

/** httpOnly cookie that carries the backend access token (set by /api/auth/login). */
export const SESSION_COOKIE = "hub_token";

/** Fallback max-age (in seconds) when the backend omits `expiresIn`. */
export const SESSION_MAX_AGE_SECONDS = 24 * 60 * 60;

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
