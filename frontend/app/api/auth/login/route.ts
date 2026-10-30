import { NextRequest, NextResponse } from "next/server";
import { getApiBaseUrl } from "@/lib/api-base-url";
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from "@/lib/session";

type LoginPayload = Readonly<{
  accessToken: string;
  expiresIn?: number;
}>;

/**
 * Forwards credentials to the backend and, on success, stores the access
 * token in an httpOnly cookie so client JavaScript can never read it.
 */
export async function POST(request: NextRequest) {
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

    const response = NextResponse.json({ ok: true }, { status: 200 });
    response.cookies.set({
      name: SESSION_COOKIE,
      value: payload.accessToken,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
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
