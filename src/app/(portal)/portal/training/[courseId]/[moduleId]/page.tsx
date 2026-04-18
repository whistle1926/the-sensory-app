"use client";

import { use, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Award,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  Home,
  List,
  RotateCcw,
  Sparkles,
  XCircle,
} from "lucide-react";
import { VideoPlayer } from "@/components/training/video-player";
import { NotesPanel } from "@/components/training/notes-panel";
import { LessonBody, type LessonSection } from "@/components/training/lesson-body";
import { LessonEmptyState } from "@/components/training/lesson-empty-state";
import {
  ModuleDrawer,
  type DrawerModule,
} from "@/components/training/module-drawer";
import "../../training.css";

/**
 * Immersive lesson player.
 *
 * Replaces the old tabbed left-rail layout with a focused, modern learning
 * surface: sticky progress bar on top, optional video / illustrated hero,
 * typography-rich lesson body, quiz as a clean card, sticky action footer
 * with Previous / Next / Mark complete.
 *
 * The permanent sidebar is gone — modules live in a slide-out drawer
 * opened from the top bar. Notes are surfaced via a toggle, not a tab.
 */

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

interface CoursePayload {
  id: string;
  title: string;
  modules: DrawerModule[];
}

interface QuizResult {
  score: number;
  passed: boolean;
  feedback: {
    questionId: string;
    isCorrect: boolean;
    correctIndex: number;
    selected: number;
  }[];
  status: string;
  attempts: number;
}

export default function PortalModulePage({
  params,
}: {
  params: Promise<{ courseId: string; moduleId: string }>;
}) {
  const { courseId, moduleId } = use(params);
  const router = useRouter();

  const [mod, setMod] = useState<ModuleData | null>(null);
  const [course, setCourse] = useState<CoursePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<QuizResult | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [marking, setMarking] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showNotes, setShowNotes] = useState(false);

  const loadModule = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/courses/${courseId}/modules/${moduleId}`).then((r) =>
        r.json(),
      ),
      fetch(`/api/courses/${courseId}`).then((r) => r.json()),
    ]).then(([modData, courseData]) => {
      setMod(modData);
      setCourse({
        id: courseData.id,
        title: courseData.title,
        modules: courseData.modules ?? [],
      });
      setLoading(false);
    });
  }, [courseId, moduleId]);

  useEffect(() => {
    loadModule();
  }, [loadModule]);

  useEffect(() => {
    setAnswers([]);
    setResult(null);
    setShowNotes(false);
  }, [moduleId]);

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
    const res = await fetch(
      `/api/courses/${courseId}/modules/${moduleId}/submit`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      },
    );
    const data = await res.json();
    setResult(data);
    setSubmitting(false);
    if (data?.passed) {
      fetch(`/api/courses/${courseId}`)
        .then((r) => r.json())
        .then((courseData) =>
          setCourse({
            id: courseData.id,
            title: courseData.title,
            modules: courseData.modules ?? [],
          }),
        )
        .catch(() => undefined);
    }
  };

  const handleRetry = async () => {
    setRetrying(true);
    await fetch(`/api/courses/${courseId}/modules/${moduleId}/retry`, {
      method: "POST",
    });
    setResult(null);
    setAnswers([]);
    setRetrying(false);
    loadModule();
  };

  const handleMarkComplete = async () => {
    if (!mod || !course) return;
    setMarking(true);
    const res = await fetch(
      `/api/courses/${courseId}/modules/${moduleId}/complete`,
      { method: "POST" },
    );
    setMarking(false);
    if (!res.ok) return;
    // Move on: next module if any, else back to course overview.
    const currentIndex = course.modules.findIndex((m) => m.id === moduleId);
    const nextModule = course.modules[currentIndex + 1];
    if (nextModule) {
      router.push(`/portal/training/${courseId}/${nextModule.id}`);
    } else {
      router.push(`/portal/training/${courseId}`);
    }
  };

  if (loading || !mod || !course) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const hasQuiz = mod.questions.length > 0;
  const isCompleted = mod.status === "COMPLETED";
  const hasContent = (mod.content.sections?.length ?? 0) > 0;
  const hasVideo = !!mod.videoUrl;
  const allAnswered =
    hasQuiz &&
    answers.length === mod.questions.length &&
    answers.every((a) => a !== null);

  const currentIndex = course.modules.findIndex((m) => m.id === moduleId);
  const prevModule = currentIndex > 0 ? course.modules[currentIndex - 1] : null;
  const nextModule =
    currentIndex >= 0 && currentIndex < course.modules.length - 1
      ? course.modules[currentIndex + 1]
      : null;
  const nextLocked = nextModule?.status === "LOCKED";

  const completedCount = course.modules.filter(
    (m) => m.status === "COMPLETED",
  ).length;
  const progressPercent =
    course.modules.length > 0
      ? Math.round((completedCount / course.modules.length) * 100)
      : 0;

  return (
    <div className="lp-shell">
      {/* Sticky top bar */}
      <header className="lp-player-top">
        <div className="lp-player-top-inner">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="lp-drawer-toggle"
            aria-label="Open module list"
          >
            <List className="h-4 w-4" />
            Modules
          </button>
          <div className="lp-player-progress">
            <p className="title">{course.title}</p>
            <div className="bar">
              <span style={{ width: `${progressPercent}%` }} />
            </div>
            <div className="meta">
              <span>
                Module {mod.order + 1} of {course.modules.length}
              </span>
              <span className="tabular-nums">{progressPercent}%</span>
            </div>
          </div>
          <Link
            href="/portal/training"
            className="hidden items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground sm:inline-flex"
          >
            <Home className="h-3.5 w-3.5" /> All courses
          </Link>
        </div>
      </header>

      <ModuleDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        courseId={course.id}
        courseTitle={course.title}
        modules={course.modules}
        currentId={moduleId}
        progressPercent={progressPercent}
      />

      {/* Hero — title + meta + video or illustration */}
      <div className="lp-lesson-hero">
        <p className="lp-lesson-crumb">Module {mod.order + 1}</p>
        <h1 className="lp-lesson-h1">{mod.title}</h1>
        <div className="lp-lesson-meta">
          <span className="inline-flex items-center gap-1.5">
            <BookOpen className="h-4 w-4" />
            {hasContent ? `${mod.content.sections.length} section${mod.content.sections.length === 1 ? "" : "s"}` : "Content coming soon"}
          </span>
          {hasQuiz && (
            <span className="inline-flex items-center gap-1.5">
              <Award className="h-4 w-4" />
              {mod.questions.length}-question quiz
            </span>
          )}
          {isCompleted && (
            <span className="chip-complete">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Completed{mod.score != null ? ` · ${mod.score}%` : ""}
            </span>
          )}
        </div>
      </div>

      {/* Media hero */}
      <div className="lp-media-hero">
        <div className="lp-media-hero-inner">
          {hasVideo ? (
            <VideoPlayer url={mod.videoUrl!} title={mod.title} />
          ) : (
            <div className="lp-illus-hero">
              <div className="icon">
                <BookOpen className="h-10 w-10" />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Body: lesson or quiz results */}
      {result ? (
        <QuizResults
          result={result}
          questions={mod.questions}
          courseId={courseId}
          nextModule={nextModule && !nextLocked ? nextModule : null}
          onRetry={handleRetry}
          retrying={retrying}
          onReview={() => setResult(null)}
        />
      ) : (
        <>
          {/* Lesson body */}
          <div className="lp-body">
            {hasContent ? (
              <LessonBody sections={mod.content.sections as LessonSection[]} />
            ) : (
              <LessonEmptyState moduleTitle={mod.title} hasQuiz={hasQuiz} />
            )}
          </div>

          {/* Quiz (only when there is one and we're not already complete) */}
          {hasQuiz && !isCompleted && (
            <div className="lp-quiz">
              <div className="mb-4 flex items-center gap-2">
                <Sparkles
                  className="h-4 w-4"
                  style={{ color: "var(--primary)" }}
                />
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">
                  Check your understanding
                </p>
              </div>
              {mod.questions.map((q, qi) => (
                <div key={q.id} className="lp-quiz-card">
                  <p className="q-label">Question {qi + 1}</p>
                  <p className="q-text">{q.text}</p>
                  {q.options.map((opt, oi) => (
                    <button
                      type="button"
                      key={oi}
                      onClick={() => handleAnswer(qi, oi)}
                      className={`lp-quiz-option ${answers[qi] === oi ? "is-active" : ""}`}
                    >
                      <span className="letter">
                        {String.fromCharCode(65 + oi)}
                      </span>
                      <span className="flex-1">{opt}</span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}

          {/* Notes toggle */}
          {!hasQuiz && !isCompleted && (
            <div className="mx-auto max-w-[760px] px-6 pb-32">
              <button
                type="button"
                onClick={() => setShowNotes((v) => !v)}
                className="flex w-full items-center justify-between rounded-xl border border-border bg-card px-4 py-3 text-sm font-semibold transition-colors hover:bg-muted"
              >
                <span>Your notes</span>
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${showNotes ? "rotate-180" : ""}`}
                />
              </button>
              {showNotes && (
                <div className="mt-3 rounded-xl border border-border bg-card p-4">
                  <NotesPanel moduleId={moduleId} />
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Sticky bottom action bar */}
      {!result && (
        <footer className="lp-bottom-bar">
          <div className="lp-bottom-bar-inner">
            {prevModule ? (
              <Link
                href={`/portal/training/${courseId}/${prevModule.id}`}
                className="lp-btn"
              >
                <ArrowLeft className="h-4 w-4" />
                Previous
              </Link>
            ) : (
              <Link href={`/portal/training/${courseId}`} className="lp-btn">
                <ArrowLeft className="h-4 w-4" />
                Overview
              </Link>
            )}

            <div className="flex-1" />

            {hasQuiz && !isCompleted ? (
              <button
                type="button"
                className="lp-btn primary"
                disabled={!allAnswered || submitting}
                onClick={handleSubmit}
              >
                {submitting ? "Submitting…" : "Submit answers"}
                <ArrowRight className="h-4 w-4" />
              </button>
            ) : isCompleted ? (
              nextModule && !nextLocked ? (
                <Link
                  href={`/portal/training/${courseId}/${nextModule.id}`}
                  className="lp-btn primary"
                >
                  Next module
                  <ArrowRight className="h-4 w-4" />
                </Link>
              ) : (
                <Link
                  href={`/portal/training/${courseId}`}
                  className="lp-btn primary"
                >
                  Back to course
                  <ArrowRight className="h-4 w-4" />
                </Link>
              )
            ) : (
              // Content-only module: offer mark-complete
              <button
                type="button"
                className="lp-btn primary"
                disabled={marking}
                onClick={handleMarkComplete}
              >
                <CheckCircle2 className="h-4 w-4" />
                {marking ? "Saving…" : "Mark complete"}
              </button>
            )}
          </div>
        </footer>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────── */
/*  Quiz results                                                       */
/* ────────────────────────────────────────────────────────────────── */

function QuizResults({
  result,
  questions,
  courseId,
  nextModule,
  onRetry,
  retrying,
  onReview,
}: {
  result: QuizResult;
  questions: Question[];
  courseId: string;
  nextModule: DrawerModule | null;
  onRetry: () => void;
  retrying: boolean;
  onReview: () => void;
}) {
  return (
    <div className="lp-result-card">
      <div className={`lp-result-hero ${result.passed ? "pass" : "fail"}`}>
        {result.passed ? (
          <CheckCircle2 className="mx-auto mb-3 h-14 w-14 text-green-600" />
        ) : (
          <XCircle className="mx-auto mb-3 h-14 w-14 text-red-500" />
        )}
        <p className="score">{result.score}%</p>
        <p
          className={`mt-1 text-sm font-semibold ${
            result.passed
              ? "text-green-700 dark:text-green-400"
              : "text-red-700 dark:text-red-400"
          }`}
        >
          {result.passed
            ? "Passed — well done!"
            : "Not quite — 80% needed to pass"}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Attempt {result.attempts}
        </p>
      </div>

      <div className="mt-6 space-y-3">
        {result.feedback.map((fb, i) => {
          const q = questions[i];
          return (
            <div
              key={fb.questionId}
              className={`rounded-2xl border p-4 ${
                fb.isCorrect
                  ? "border-green-200 bg-green-50/60 dark:bg-green-950/40"
                  : "border-red-200 bg-red-50/60 dark:bg-red-950/40"
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
                        ? "font-semibold text-green-700 dark:text-green-400"
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
                    {oi !== fb.correctIndex && oi !== fb.selected && (
                      <span className="w-3.5" />
                    )}
                    <span>
                      {String.fromCharCode(65 + oi)}. {opt}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 flex flex-wrap gap-3 pb-32">
        {result.passed ? (
          nextModule ? (
            <Link
              href={`/portal/training/${courseId}/${nextModule.id}`}
              className="lp-btn primary flex-1 justify-center"
            >
              Next module
              <ArrowRight className="h-4 w-4" />
            </Link>
          ) : (
            <Link
              href={`/portal/training/${courseId}`}
              className="lp-btn primary flex-1 justify-center"
            >
              Back to course
              <ArrowRight className="h-4 w-4" />
            </Link>
          )
        ) : (
          <>
            <button
              type="button"
              className="lp-btn"
              onClick={onReview}
            >
              Review lesson
            </button>
            <button
              type="button"
              onClick={onRetry}
              disabled={retrying}
              className="lp-btn primary flex-1 justify-center"
            >
              <RotateCcw className="h-4 w-4" />
              {retrying ? "Resetting…" : "Try again"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
