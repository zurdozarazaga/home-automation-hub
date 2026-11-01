import { NextResponse } from "next/server";
import { isSameOrigin } from "@/lib/origin";
import { SESSION_COOKIE, SESSION_COOKIE_SECURE } from "@/lib/session";

/** Clears the session cookie; the client navigates back to /login. */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json(
      { statusCode: 403, message: "Cross-origin request rejected" },
      { status: 403 },
    );
  }

  const response = NextResponse.json({ ok: true }, { status: 200 });

  // Both names must be expired: the browser only accepts a `__Host-` cookie
  // (including its deletion) when it carries `Secure` and `Path=/`.
  response.cookies.set({
    name: SESSION_COOKIE_SECURE,
    value: "",
    httpOnly: true,
    sameSite: "strict",
    secure: true,
    path: "/",
    maxAge: 0,
  });
  response.cookies.set({
    name: SESSION_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "strict",
    secure: false,
    path: "/",
    maxAge: 0,
  });

  return response;
}
