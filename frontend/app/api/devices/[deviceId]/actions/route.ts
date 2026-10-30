import { NextRequest, NextResponse } from "next/server";
import { getApiBaseUrl } from "@/lib/api-base-url";
import { SESSION_COOKIE } from "@/lib/session";

type ActionRequestBody = Readonly<{
  action: "turn_on" | "turn_off";
  // Widened: the backend capability-checks driver-declared targets at runtime.
  target: string;
}>;

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ deviceId: string }> },
) {
  try {
    const { deviceId } = await context.params;
    const body = (await request.json()) as ActionRequestBody;
    const cookieToken = request.cookies.get(SESSION_COOKIE)?.value;
    // Cookie session first; keep forwarding an explicit incoming header.
    const authorization = cookieToken
      ? `Bearer ${cookieToken}`
      : request.headers.get("authorization");

    const response = await fetch(
      `${getApiBaseUrl()}/devices/${deviceId}/actions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(authorization ? { authorization } : {}),
        },
        body: JSON.stringify(body),
        cache: "no-store",
      },
    );

    const responseText = await response.text();
    const contentType = response.headers.get("content-type") ?? "";

    return new NextResponse(responseText, {
      status: response.status,
      headers: {
        "content-type": contentType,
      },
    });
  } catch {
    return NextResponse.json(
      {
        statusCode: 502,
        error: "Bad Gateway",
        message: "Unable to forward device action request",
      },
      { status: 502 },
    );
  }
}
