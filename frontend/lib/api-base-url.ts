const DEFAULT_API_BASE_URL = "http://localhost:3001";

/**
 * Server-side base URL for the NestJS API.
 *
 * The browser only talks to same-origin route handlers, so this is read on
 * the server: inside docker compose the backend is reachable as
 * `http://backend:3001`, while a host-run `npm run dev` uses
 * `http://localhost:3001`.
 *
 * NEXT_PUBLIC_API_BASE_URL stays as a deprecated fallback because the prod
 * compose file still injects it at runtime.
 */
export function getApiBaseUrl(): string {
  const configured =
    process.env.API_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_API_BASE_URL?.trim();

  return configured || DEFAULT_API_BASE_URL;
}
