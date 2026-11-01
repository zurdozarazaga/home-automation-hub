/**
 * Same-origin guard for state-changing route handlers.
 *
 * Traefik terminates TLS and forwards plain HTTP, so the public host the
 * browser used arrives as `x-forwarded-host` (the `host` header falls back to
 * the internal service address). A browser `Origin` must match that host;
 * requests without an `Origin` header are allowed because non-browser clients
 * (curl, server-to-server) do not send one and cannot ride a victim's cookie.
 */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");

  if (!origin) {
    return true;
  }

  let originHost: string;

  try {
    originHost = new URL(origin).host;
  } catch {
    return false;
  }

  const forwardedHost = request.headers
    .get("x-forwarded-host")
    ?.split(",")[0]
    ?.trim();
  const expectedHost = forwardedHost || request.headers.get("host") || "";

  return expectedHost !== "" && originHost === expectedHost;
}
