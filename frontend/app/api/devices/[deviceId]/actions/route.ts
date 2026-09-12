import { NextRequest, NextResponse } from "next/server";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || "http://localhost:3001";

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

    const response = await fetch(
      `${API_BASE_URL}/devices/${deviceId}/actions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
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
