import { NextResponse } from "next/server";

const VOICESTUDIO_URL =
  process.env.VOICESTUDIO_URL?.replace(/\/$/, "") ||
  "https://voicestudio.voguemirror.com";

export async function GET() {
  try {
    const res = await fetch(`${VOICESTUDIO_URL}/health`, {
      cache: "no-store",
    });
    const data = await res.json().catch(() => null);
    return NextResponse.json({
      ok: res.ok,
      upstreamStatus: res.status,
      url: VOICESTUDIO_URL,
      health: data,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        url: VOICESTUDIO_URL,
        error: err instanceof Error ? err.message : "Health check failed",
      },
      { status: 502 },
    );
  }
}
