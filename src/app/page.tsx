"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { TTS_TIMEOUT_MS } from "@/lib/timeouts";

type LanguageOption = {
  code: string;
  label: string;
  sample: string;
  dir?: "ltr" | "rtl";
};

const LANGUAGES: LanguageOption[] = [
  {
    code: "en",
    label: "English",
    sample: "Hello from VoiceStudio. This is a test of the deployed API.",
  },
  {
    code: "ur",
    label: "Urdu",
    sample: "وائس اسٹوڈیو سے سلام۔ یہ تعیناتی کا ایک ٹیسٹ ہے۔",
    dir: "rtl",
  },
  {
    code: "pa",
    label: "Punjabi",
    sample: "وائس اسٹوڈیو توں سلام۔ ایہہ تعیناتی دا اک ٹیسٹ اے۔",
    dir: "rtl",
  },
  {
    code: "skr",
    label: "Saraiki",
    sample: "وائس سٹوڈیو کنوں سلام۔ ایہ تعیناتی دا ہک ٹیسٹ ہے۔",
    dir: "rtl",
  },
  {
    code: "sd",
    label: "Sindhi",
    sample: "وائس اسٽوڊيو مان سلام۔ هي تعیناتي جو هڪ ٽيسٽ آهي۔",
    dir: "rtl",
  },
];

export default function Home() {
  const [language, setLanguage] = useState("en");
  const [text, setText] = useState(LANGUAGES[0].sample);
  const [loading, setLoading] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [health, setHealth] = useState<string>("checking…");
  const abortRef = useRef<AbortController | null>(null);

  const selected = useMemo(
    () => LANGUAGES.find((l) => l.code === language) || LANGUAGES[0],
    [language],
  );

  useEffect(() => {
    if (!loading) {
      setElapsedSec(0);
      return;
    }
    const started = Date.now();
    const id = window.setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - started) / 1000));
    }, 1000);
    return () => window.clearInterval(id);
  }, [loading]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/health")
      .then(async (res) => {
        const data = await res.json();
        if (cancelled) return;
        if (data.ok) {
          const device = data.health?.device || "unknown device";
          const version = data.health?.version || "?";
          setHealth(`online · v${version} · ${device}`);
        } else {
          setHealth(`offline · ${data.error || `HTTP ${data.upstreamStatus}`}`);
        }
      })
      .catch((err) => {
        if (!cancelled) setHealth(`offline · ${err.message}`);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  function onLanguageChange(code: string) {
    const next = LANGUAGES.find((l) => l.code === code);
    setLanguage(code);
    if (next) setText(next.sample);
    setError(null);
  }

  async function generateVoice() {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const timeoutId = window.setTimeout(() => controller.abort(), TTS_TIMEOUT_MS);

    setLoading(true);
    setError(null);
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }

    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          language,
          format: "mp3",
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(
          payload?.detail ||
            payload?.error ||
            `Request failed with status ${res.status}`,
        );
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setError(
          `Timed out after ${Math.floor(TTS_TIMEOUT_MS / 60000)} minutes. CPU TTS can be slow — wait longer with shorter text, or use a GPU instance.`,
        );
      } else {
        setError(err instanceof Error ? err.message : "Generation failed");
      }
    } finally {
      window.clearTimeout(timeoutId);
      if (abortRef.current === controller) abortRef.current = null;
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-5 py-10 sm:px-8">
      <header className="mb-8">
        <p className="mb-2 text-sm tracking-wide text-[var(--ink-muted)] uppercase">
          Local deployment tester
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          VoiceStudio Test Client
        </h1>
        <p className="mt-3 max-w-2xl text-[var(--ink-muted)]">
          Select a language, paste text, and generate speech against{" "}
          <span className="font-medium text-[var(--foreground)]">
            voicestudio.voguemirror.com
          </span>
          .
        </p>
        <p className="mt-3 inline-flex rounded-full bg-[var(--accent-soft)] px-3 py-1 text-sm text-[var(--accent)]">
          Backend: {health}
        </p>
      </header>

      <section className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-5 shadow-sm sm:p-7">
        <label className="mb-2 block text-sm font-medium">Language</label>
        <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {LANGUAGES.map((lang) => {
            const active = lang.code === language;
            return (
              <button
                key={lang.code}
                type="button"
                onClick={() => onLanguageChange(lang.code)}
                className={`rounded-xl border px-3 py-2 text-sm transition ${
                  active
                    ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                    : "border-[var(--line)] bg-white text-[var(--foreground)] hover:border-[var(--accent)]"
                }`}
              >
                {lang.label}
              </button>
            );
          })}
        </div>

        <label className="mb-2 block text-sm font-medium" htmlFor="tts-text">
          Text
        </label>
        <textarea
          id="tts-text"
          value={text}
          dir={selected.dir || "ltr"}
          onChange={(e) => setText(e.target.value)}
          rows={7}
          className="mb-2 w-full rounded-xl border border-[var(--line)] bg-white px-4 py-3 text-base outline-none ring-[var(--accent)] focus:ring-2"
          placeholder="Paste text to speak…"
        />
        <p className="mb-6 text-xs text-[var(--ink-muted)]">
          {text.length} / 4096 characters
        </p>

        <button
          type="button"
          onClick={generateVoice}
          disabled={loading || !text.trim()}
          className="inline-flex items-center justify-center rounded-xl bg-[var(--accent)] px-5 py-3 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading
            ? `Generating voice… ${elapsedSec}s (CPU can take 2–5 min)`
            : "Generate voice"}
        </button>
        {loading ? (
          <p className="mt-3 text-sm text-[var(--ink-muted)]">
            Please keep this tab open. On CPU, generation often takes a few
            minutes and will not time out until 10 minutes.
          </p>
        ) : null}

        {error ? (
          <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-[var(--danger)]">
            {error}
          </p>
        ) : null}

        {audioUrl ? (
          <div className="mt-6 rounded-xl border border-[var(--line)] bg-white p-4">
            <p className="mb-3 text-sm font-medium">Generated audio</p>
            <audio controls autoPlay src={audioUrl} className="w-full">
              Your browser does not support the audio element.
            </audio>
            <a
              href={audioUrl}
              download={`voicestudio-${language}.mp3`}
              className="mt-3 inline-block text-sm text-[var(--accent)] underline"
            >
              Download MP3
            </a>
          </div>
        ) : null}
      </section>
    </main>
  );
}
