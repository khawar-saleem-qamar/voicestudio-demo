import { NextRequest, NextResponse } from "next/server";
import { TTS_TIMEOUT_MS, TTS_TIMEOUT_SECONDS } from "@/lib/timeouts";

// Vercel Hobby allows maxDuration up to 300 seconds.
export const maxDuration = 300;

const VOICESTUDIO_URL =
  process.env.VOICESTUDIO_URL?.replace(/\/$/, "") ||
  "https://voicestudio.voguemirror.com";
const API_KEY = process.env.VOICESTUDIO_API_KEY || "";

const ALLOWED_LANGUAGES = new Set(["en", "ur", "pa", "skr", "sd"]);

export async function POST(req: NextRequest) {
  if (!API_KEY) {
    return NextResponse.json(
      {
        error:
          "Missing VOICESTUDIO_API_KEY. Add it to voice-test-client/.env.local",
      },
      { status: 500 },
    );
  }

  let body: {
    text?: string;
    language?: string;
    voice?: string;
    format?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const text = (body.text || "").trim();
  const language = (body.language || "en").toLowerCase();
  const voice = body.voice || "default";
  const format = body.format === "wav" ? "wav" : "mp3";

  if (!text) {
    return NextResponse.json({ error: "Text is required" }, { status: 400 });
  }
  if (text.length > 4096) {
    return NextResponse.json(
      { error: "Text must be 4096 characters or fewer" },
      { status: 400 },
    );
  }
  if (!ALLOWED_LANGUAGES.has(language)) {
    return NextResponse.json(
      { error: `Unsupported language: ${language}` },
      { status: 400 },
    );
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${VOICESTUDIO_URL}/v1/audio/speech`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
        Accept: "*/*",
      },
      body: JSON.stringify({
        model: "omnivoice",
        voice,
        input: text,
        language,
        response_format: format,
        speed: 1.0,
      }),
      // CPU inference can take several minutes.
      signal: AbortSignal.timeout(TTS_TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upstream request failed";
    const timedOut =
      (err instanceof Error && err.name === "TimeoutError") ||
      /aborted|timeout/i.test(message);

    return NextResponse.json(
      {
        error: timedOut
          ? `VoiceStudio TTS timed out after ${TTS_TIMEOUT_SECONDS}s. Try shorter text or a GPU instance.`
          : message,
      },
      { status: 504 },
    );
  }

  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => "");
    return NextResponse.json(
      {
        error: "VoiceStudio TTS failed",
        status: upstream.status,
        detail: detail.slice(0, 2000),
      },
      { status: 502 },
    );
  }

  const audio = await upstream.arrayBuffer();
  const contentType =
    upstream.headers.get("content-type") ||
    (format === "wav" ? "audio/wav" : "audio/mpeg");

  return new NextResponse(audio, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "no-store",
    },
  });
}
