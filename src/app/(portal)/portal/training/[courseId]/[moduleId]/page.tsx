"use client";

import { use, useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  XCircle,
  RotateCcw,
  BookOpen,
  Lock,
  Circle,
} from "lucide-react";

interface Section {
  heading?: string;
  body: string;
}

interface Question {
  id: string;
  text: string;
  options: string[];
  correctIndex?: number;
}

interface ModuleData {
  id: string;
  title: string;
  order: number;
  content: { sections: Section[] };
  questions: Question[];
  videoUrl: string | null;
  status: "IN_PROGRESS" | "COMPLETED" | "FAILED";
  score: number | null;
  attempts: number;
}

interface OutlineModule {
  id: string;
  title: string;
  order: number;
  status: "LOCKED" | "IN_PROGRESS" | "COMPLETED" | "FAILED";
}

interface QuizResult {
  score: number;
  passed: boolean;
  feedback: { questionId: string; isCorrect: boolean; correctIndex: number; selected: number }[];
  status: string;
  attempts: number;
}

type View = "lesson" | "quiz" | "results";

function toEmbedUrl(url: string): { type: "iframe" | "video"; src: string } {
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
  if (yt) return { type: "iframe", src: `https://www.youtube.com/embed/${yt[1]}` };
  const vimeo = url.match(/vimeo\.com\/(\d+)/);
  if (vimeo) return { type: "iframe", src: `https://player.vimeo.com/video/${vimeo[1]}` };
  return { type: "video", src: url };
}

export default function PortalModulePage({
  params,
}: {
  params: Promise<{ courseId: string; moduleId: string }>;
}) {
  const { courseId, moduleId } = use(params);
  const router = useRouter();

  const [mod, setMod] = useState<ModuleData | null>(null);
  const [outline, setOutline] = useState<OutlineModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>("lesson");
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<QuizResult | null>(null);
  const [retrying, setRetrying] = useState(false);

  const loadModule = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/courses/${courseId}/modules/${moduleId}`).then((r) => r.json()),
      fetch(`/api/courses/${courseId}`).then((r) => r.json()),
    ]).then(([modData, courseData]) => {
      setMod(modData);
      setOutline(courseData.modules || []);
      setLoading(false);
    });
  }, [courseId, moduleId]);

  useEffect(() => {
    loadModule();
  }, [loadModule]);

  const handleAnswer = (qIndex: number, optIndex: number) => {
    setAnswers((prev) => {
      const next = [...prev];
      next[qIndex] = optIndex;
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!mod) return;
    setSubmitting(true);
    const res = await fetch(`/api/courses/${courseId}/modules/${moduleId}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers }),
    });
    const data = await res.json();
    setResult(data);
    setView("results");
    setSubmitting(false);
  };

  const handleRetry = async () => {
    setRetrying(true);
    await fetch(`/api/courses/${courseId}/modules/${moduleId}/retry`, { method: "POST" });
    setResult(null);
    setAnswers([]);
    setRetrying(false);
    loadModule();
    setView("lesson");
  };

  if (loading || !mod) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const allAnswered =
    mod.questions.length > 0 &&
    answers.length === mod.questions.length &&
    answers.every((a) => a !== null);

  const currentIndex = outline.findIndex((m) => m.id === moduleId);
  const nextUnlocked = outline.slice(currentIndex + 1).find((m) => m.status !== "LOCKED");

  const video = mod.videoUrl ? toEmbedUrl(mod.videoUrl) : null;

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
      {/* Outline (Phase 2 will promote this to a sticky full-height sidebar) */}
      <aside className="space-y-3">
        <Link
          href={`/portal/training/${courseId}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" /> Course
        </Link>
        <div className="space-y-1">
          {outline.map((m, i) => {
            const isCurrent = m.id === moduleId;
            const clickable = m.status !== "LOCKED" && !isCurrent;
            const row = (
              <div
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                  isCurrent
                    ? "border-primary bg-secondary font-semibold"
                    : clickable
                    ? "border-border hover:border-primary/30 hover:bg-muted"
                    : "border-border opacity-60"
                }`}
              >
                <span className="w-5 text-xs font-semibold text-muted-foreground">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate">{m.title}</span>
                {m.status === "LOCKED" && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
                {m.status === "IN_PROGRESS" && <Circle className="h-3.5 w-3.5 text-primary" />}
                {m.status === "COMPLETED" && <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />}
                {m.status === "FAILED" && <XCircle className="h-3.5 w-3.5 text-red-500" />}
              </div>
            );
            return clickable ? (
              <Link key={m.id} href={`/portal/training/${courseId}/${m.id}`}>
                {row}
              </Link>
            ) : (
              <div key={m.id}>{row}</div>
            );
          })}
        </div>
      </aside>

      {/* Main */}
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary">
            <span className="text-sm font-bold text-primary">{mod.order}</span>
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">{mod.title}</h1>
            {mod.status === "COMPLETED" && (
              <p className="text-xs font-semibold text-green-600">
                Completed — Score: {mod.score}%
              </p>
            )}
          </div>
        </div>

        {video && (
          <div className="overflow-hidden rounded-2xl border border-border bg-black shadow-[var(--shadow-sm)]">
            {video.type === "iframe" ? (
              <iframe
                src={video.src}
                className="aspect-video w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title={mod.title}
              />
            ) : (
              <video src={video.src} controls className="aspect-video w-full" />
            )}
          </div>
        )}

        {mod.status !== "COMPLETED" && mod.questions.length > 0 && (
          <div className="flex gap-1 rounded-xl bg-muted p-1">
            <button
              onClick={() => setView("lesson")}
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                view === "lesson"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <BookOpen className="mr-1.5 inline h-4 w-4" /> Lesson
            </button>
            <button
              onClick={() => {
                setView("quiz");
                if (answers.length === 0) setAnswers(new Array(mod.questions.length).fill(null));
              }}
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                view === "quiz"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Take Quiz
            </button>
          </div>
        )}

        {view === "lesson" && (
          <div className="space-y-6">
            {mod.content.sections.map((section, i) => (
              <div
                key={i}
                className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-sm)]"
              >
                {section.heading && (
                  <h2 className="mb-3 text-lg font-bold">{section.heading}</h2>
                )}
                <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/80">
                  {section.body}
                </div>
              </div>
            ))}

            {mod.status !== "COMPLETED" && mod.questions.length > 0 && (
              <button
                onClick={() => {
                  setView("quiz");
                  if (answers.length === 0) setAnswers(new Array(mod.questions.length).fill(null));
                }}
                className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary/80"
              >
                Take Quiz <ArrowRight className="ml-2 inline h-4 w-4" />
              </button>
            )}
          </div>
        )}

        {view === "quiz" && (
          <div className="space-y-4">
            {mod.questions.map((q, qi) => (
              <div
                key={q.id}
                className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-sm)]"
              >
                <p className="font-semibold">
                  <span className="mr-2 text-primary">Q{qi + 1}.</span>
                  {q.text}
                </p>
                <div className="mt-3 space-y-2">
                  {q.options.map((opt, oi) => (
                    <button
                      key={oi}
                      onClick={() => handleAnswer(qi, oi)}
                      className={`w-full rounded-xl border px-4 py-3 text-left text-sm transition-all ${
                        answers[qi] === oi
                          ? "border-primary bg-secondary font-medium"
                          : "border-border text-foreground/80 hover:border-primary/30"
                      }`}
                    >
                      <span className="mr-2 font-semibold text-muted-foreground">
                        {String.fromCharCode(65 + oi)}.
                      </span>
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <button
              onClick={handleSubmit}
              disabled={!allAnswered || submitting}
              className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary/80 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? "Submitting..." : "Submit Answers"}
            </button>
          </div>
        )}

        {view === "results" && result && (
          <div className="space-y-4">
            <div
              className={`rounded-2xl p-6 text-center ${
                result.passed
                  ? "border border-green-200 bg-green-50 dark:bg-green-950/50"
                  : "border border-red-200 bg-red-50 dark:bg-red-950/50"
              }`}
            >
              {result.passed ? (
                <CheckCircle2 className="mx-auto mb-3 h-12 w-12 text-green-600" />
              ) : (
                <XCircle className="mx-auto mb-3 h-12 w-12 text-red-500" />
              )}
              <p className="text-2xl font-bold tracking-tight">{result.score}%</p>
              <p
                className={`mt-1 text-sm font-semibold ${
                  result.passed
                    ? "text-green-700 dark:text-green-400"
                    : "text-red-700 dark:text-red-400"
                }`}
              >
                {result.passed ? "Passed! Well done." : "Not quite — you need 80% to pass."}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">Attempt {result.attempts}</p>
            </div>

            {result.feedback.map((fb, i) => {
              const q = mod.questions[i];
              return (
                <div
                  key={fb.questionId}
                  className={`rounded-2xl border p-4 ${
                    fb.isCorrect
                      ? "border-green-200 bg-green-50/50 dark:bg-green-950/50"
                      : "border-red-200 bg-red-50/50 dark:bg-red-950/50"
                  }`}
                >
                  <p className="text-sm font-semibold">
                    <span className="mr-1">Q{i + 1}.</span> {q.text}
                  </p>
                  <div className="mt-2 space-y-1">
                    {q.options.map((opt, oi) => (
                      <div
                        key={oi}
                        className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm ${
                          oi === fb.correctIndex
                            ? "font-semibold text-green-700"
                            : oi === fb.selected && !fb.isCorrect
                            ? "text-red-600 line-through"
                            : "text-muted-foreground"
                        }`}
                      >
                        {oi === fb.correctIndex && (
                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-600" />
                        )}
                        {oi === fb.selected && !fb.isCorrect && (
                          <XCircle className="h-3.5 w-3.5 shrink-0 text-red-500" />
                        )}
                        {oi !== fb.correctIndex && oi !== fb.selected && <span className="w-3.5" />}
                        <span>
                          {String.fromCharCode(65 + oi)}. {opt}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            <div className="flex gap-3">
              {result.passed ? (
                nextUnlocked ? (
                  <button
                    onClick={() => router.push(`/portal/training/${courseId}/${nextUnlocked.id}`)}
                    className="flex-1 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary/80"
                  >
                    Next module <ArrowRight className="ml-2 inline h-4 w-4" />
                  </button>
                ) : (
                  <Link
                    href={`/portal/training/${courseId}`}
                    className="flex-1 rounded-xl bg-primary px-4 py-3 text-center text-sm font-semibold text-white transition-colors hover:bg-primary/80"
                  >
                    Back to course <ArrowRight className="ml-2 inline h-4 w-4" />
                  </Link>
                )
              ) : (
                <button
                  onClick={handleRetry}
                  disabled={retrying}
                  className="flex-1 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary/80 disabled:opacity-50"
                >
                  <RotateCcw className="mr-2 inline h-4 w-4" />
                  {retrying ? "Resetting..." : "Try again"}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
