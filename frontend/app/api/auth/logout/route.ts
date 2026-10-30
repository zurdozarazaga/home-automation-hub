import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/session";

/** Clears the session cookie; the client navigates back to /login. */
export async function POST() {
  const response = NextResponse.json({ ok: true }, { status: 200 });
  response.cookies.delete(SESSION_COOKIE);

  return response;
}
