import { NextRequest, NextResponse } from "next/server";
import { getApiBaseUrl } from "@/lib/api-base-url";
import { isSameOrigin } from "@/lib/origin";
import {
  SESSION_MAX_AGE_SECONDS,
  sessionCookieName,
} from "@/lib/session";

type LoginPayload = Readonly<{
  accessToken: string;
  expiresIn?: number;
}>;

/**
 * True when the browser reached us over HTTPS.
 *
 * Traefik terminates TLS and forwards plain HTTP, so the forwarded protocol is
 * the authoritative signal; the request protocol is the local-dev fallback.
 */
function isSecureRequest(request: NextRequest): boolean {
  const forwardedProto = request.headers
    .get("x-forwarded-proto")
    ?.split(",")[0]
    ?.trim();

  if (forwardedProto) {
    return forwardedProto.toLowerCase() === "https";
  }

  return request.nextUrl.protocol === "https:";
}

/**
 * Forwards credentials to the backend and, on success, stores the access
 * token in an httpOnly cookie so client JavaScript can never read it.
 */
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return NextResponse.json(
      { statusCode: 403, message: "Cross-origin request rejected" },
      { status: 403 },
    );
  }

  let credentials: unknown;

  try {
    credentials = await request.json();
  } catch {
    return NextResponse.json(
      { statusCode: 400, message: "Invalid request body" },
      { status: 400 },
    );
  }

  try {
    const backendResponse = await fetch(`${getApiBaseUrl()}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(credentials),
      cache: "no-store",
    });

    if (!backendResponse.ok) {
      return NextResponse.json(
        { statusCode: backendResponse.status, message: "Login rejected" },
        { status: backendResponse.status },
      );
    }

    const payload = (await backendResponse.json()) as LoginPayload;
    const maxAge =
      typeof payload.expiresIn === "number" && payload.expiresIn > 0
        ? payload.expiresIn
        : SESSION_MAX_AGE_SECONDS;
    const isSecure = isSecureRequest(request);

    const response = NextResponse.json({ ok: true }, { status: 200 });
    response.cookies.set({
      name: sessionCookieName(isSecure),
      value: payload.accessToken,
      httpOnly: true,
      sameSite: "strict",
      secure: isSecure,
      path: "/",
      maxAge,
    });

    return response;
  } catch {
    return NextResponse.json(
      { statusCode: 502, message: "Unable to reach the API" },
      { status: 502 },
    );
  }
}
