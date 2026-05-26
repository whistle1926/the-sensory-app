"use client";

/**
 * Voice-to-text recorder for report session notes.
 *
 * Uses the browser's Web Speech API (SpeechRecognition) — no backend,
 * no API key, no per-minute cost. Live transcript is streamed back as
 * the OT speaks, then appended to the parent textarea on stop.
 *
 * Supported: Chrome, Edge, Safari (incl. iOS Safari). Firefox doesn't
 * implement SpeechRecognition — the component detects that and hides
 * itself rather than showing a broken button.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Mic, MicOff, Loader2 } from "lucide-react";

interface Props {
  /** Current textarea / rich-text value — recorder appends to this on stop. */
  value: string;
  /** Called with the next value (existing + transcript). */
  onChange: (next: string) => void;
  /**
   * Output format for the appended transcript.
   *  - "plain"  (default): adds "\n\n{transcript}" — for <textarea>s.
   *  - "html": adds "<p>{escaped transcript}</p>" — for TipTap rich-text
   *    editors where the value is an HTML string.
   */
  mode?: "plain" | "html";
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* ------------------------------------------------------------------ */
/*  Type shims — SpeechRecognition isn't in lib.dom.d.ts everywhere   */
/* ------------------------------------------------------------------ */

interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}
interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message?: string;
}
interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}
interface SpeechRecognitionResult {
  readonly length: number;
  readonly isFinal: boolean;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}
interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}
interface SpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => void) | null;
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => void) | null;
  onend: ((this: SpeechRecognition, ev: Event) => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognition;

/**
 * Detect support without retaining a reference to the constructor.
 *
 * Some browser extensions (MetaMask et al.) install SES /
 * "lockdown" which wraps DOM constructors with proxies. Stashing
 * one of those proxies in React state strips its [[Construct]]
 * slot, and `new Ctor()` later throws "this DOM object constructor
 * cannot be called as a function". Solution: only ever construct
 * via `window.<Name>` at the moment we need it.
 */
function isSpeechRecognitionSupported(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as unknown as {
    SpeechRecognition?: unknown;
    webkitSpeechRecognition?: unknown;
  };
  return !!(w.SpeechRecognition || w.webkitSpeechRecognition);
}

/**
 * Construct a SpeechRecognition instance. We deliberately read off
 * `window` again here (rather than from a cached reference) so
 * SES-wrapped proxies stay functional. `Reflect.construct` is a
 * second-line defence — some wrappers still break plain `new`.
 */
function createSpeechRecognition(): SpeechRecognition {
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  if (!Ctor) throw new Error("SpeechRecognition not supported");
  try {
    return new Ctor();
  } catch {
    return Reflect.construct(Ctor, []) as SpeechRecognition;
  }
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function VoiceNotesRecorder({ value, onChange, mode = "plain" }: Props) {
  // Boolean only — never stash the constructor itself (see note on
  // isSpeechRecognitionSupported above). `null` = not yet checked
  // (during SSR / first paint), so the component renders nothing.
  const [supported, setSupported] = useState<boolean | null>(null);
  useEffect(() => setSupported(isSpeechRecognitionSupported()), []);

  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  /** Transcript locked in by `isFinal` results; survives across pauses. */
  const [finalised, setFinalised] = useState("");
  /** Latest interim chunk — shown live, replaced with each `onresult`. */
  const [interim, setInterim] = useState("");

  const recogRef = useRef<SpeechRecognition | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = useCallback(() => {
    recogRef.current?.stop();
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
    setRecording(false);
  }, []);

  // Stop cleanly if the component unmounts mid-recording.
  useEffect(() => () => stop(), [stop]);

  function start() {
    if (!supported) return;
    setError(null);
    setFinalised("");
    setInterim("");
    setElapsed(0);

    let r: SpeechRecognition;
    try {
      r = createSpeechRecognition();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't start the mic.");
      return;
    }
    r.lang = "en-GB";
    r.continuous = true;
    r.interimResults = true;
    r.maxAlternatives = 1;

    r.onresult = (ev) => {
      // Web Speech delivers a growing list of results. Walk from
      // `resultIndex` to the end, split into final vs interim chunks.
      let nextFinal = "";
      let nextInterim = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const result = ev.results[i];
        const text = result[0]?.transcript ?? "";
        if (result.isFinal) nextFinal += text;
        else nextInterim += text;
      }
      if (nextFinal) {
        setFinalised((prev) => prev + nextFinal);
      }
      setInterim(nextInterim);
    };

    r.onerror = (ev) => {
      setError(
        ev.error === "not-allowed"
          ? "Mic access was denied. Allow microphone permission in your browser and try again."
          : ev.error === "no-speech"
            ? "No speech detected — try again and speak a bit louder."
            : `Speech recognition error: ${ev.error}`,
      );
      stop();
    };

    r.onend = () => {
      // Some browsers auto-stop after a long pause; reflect that in UI.
      setRecording(false);
      if (tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
    };

    recogRef.current = r;
    try {
      r.start();
      setRecording(true);
      tickRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't start the mic.");
    }
  }

  /**
   * Stop recording and push the captured transcript up to the parent
   * textarea. We append (don't replace) so the OT can record several
   * snippets across one note-taking session, and they can also type
   * around the inserted text without losing it.
   */
  function stopAndInsert() {
    stop();
    const captured = (finalised + interim).trim();
    if (!captured) return;
    if (mode === "html") {
      // Rich-text editors store an HTML string. Append a paragraph
      // so TipTap renders it cleanly alongside whatever's there.
      const next = `${value}<p>${escapeHtml(captured)}</p>`;
      onChange(next);
    } else {
      const sep = value.trim() ? `\n\n` : "";
      onChange(`${value}${sep}${captured}`);
    }
    setFinalised("");
    setInterim("");
  }

  const elapsedLabel = useMemo(() => {
    const m = Math.floor(elapsed / 60);
    const s = elapsed % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }, [elapsed]);

  // null = first paint hasn't checked yet → render nothing to avoid
  // hydration mismatch. false = checked + unsupported → show a hint
  // so the OT knows the feature exists in other browsers.
  if (supported === null) return null;
  if (supported === false) {
    return (
      <p className="text-xs text-muted-foreground">
        Voice notes aren&apos;t supported in this browser. Try Chrome, Edge,
        or Safari to use this feature.
      </p>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-muted/30 p-3">
      <div className="flex flex-wrap items-center gap-3">
        {!recording ? (
          <button
            type="button"
            onClick={start}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Mic className="h-4 w-4" />
            Record voice notes
          </button>
        ) : (
          <button
            type="button"
            onClick={stopAndInsert}
            className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-red-700"
          >
            <MicOff className="h-4 w-4" />
            Stop &amp; insert
          </button>
        )}

        {recording && (
          <>
            {/* Pulsing red dot + monospaced timer */}
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-600 tabular-nums">
              <span className="relative inline-flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-red-600" />
              </span>
              Recording · {elapsedLabel}
            </span>
          </>
        )}

        {!recording && (
          <span className="text-xs text-muted-foreground">
            Speaks straight into the notes below. Tap Stop &amp; insert when done.
          </span>
        )}
      </div>

      {/* Live transcript preview during recording */}
      {recording && (finalised || interim) && (
        <div className="mt-2 rounded-md border border-dashed border-border bg-background/60 p-2 text-xs leading-relaxed text-foreground">
          <span>{finalised}</span>
          <span className="text-muted-foreground italic">{interim}</span>
        </div>
      )}

      {error && (
        <div className="mt-2 flex items-center gap-2 rounded-md bg-red-50 px-2 py-1 text-xs text-red-700 dark:bg-red-950/30 dark:text-red-400">
          <Loader2 className="h-3 w-3" />
          {error}
        </div>
      )}
    </div>
  );
}
