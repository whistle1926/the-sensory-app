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
  Link2,
  List,
  Paperclip,
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

/* Submarine button recipes, shared by the action bar and the results
   card so every button on the page presses the same way. */
const btnPrimary =
  "sub-edge sub-press inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-[15px] font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-50";
const btnOutline =
  "sub-press inline-flex items-center gap-2 rounded-full border-[3px] border-[#12235B] bg-white px-5 py-2.5 text-[15px] font-extrabold text-[#12235B] disabled:cursor-not-allowed disabled:opacity-50";
const pinkBg = { background: "var(--sub-pink)" };

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
  coverImageUrl?: string | null;
  /** Handouts/links attached to the recording published to this lesson. */
  resources?: {
    id: string;
    title: string;
    url: string;
    kind: string;
    sizeBytes: number | null;
  }[];
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
        <div className="h-9 w-9 animate-spin rounded-full border-4 border-[#12235B] border-t-transparent" />
      </div>
    );
  }

  // Defensive: if the API ever returns an error shape instead of a module
  // (e.g. a 403), these fields are missing — fall back rather than crashing
  // the whole page with "Cannot read properties of undefined".
  const questions = mod.questions ?? [];
  const hasQuiz = questions.length > 0;
  const isCompleted = mod.status === "COMPLETED";
  const hasContent = (mod.content?.sections?.length ?? 0) > 0;
  const hasVideo = !!mod.videoUrl;
  const allAnswered =
    hasQuiz &&
    answers.length === questions.length &&
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
    <div className="min-h-[60vh]">
      {/* Sticky top bar — sits just under the portal header (72px). */}
      <header className="sticky top-[84px] z-10">
        <div className="sub-edge flex items-center gap-3 rounded-[22px] bg-white px-4 py-3 sm:gap-4 sm:px-5">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="sub-edge sub-press inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#FFC93C] px-4 py-2 text-[13px] font-extrabold text-[#12235B]"
            aria-label="Open module list"
          >
            <List className="h-4 w-4" />
            Modules
          </button>
          <div className="min-w-0 flex-1">
            <p className="sub-display truncate text-[15px] leading-tight">
              {course.title}
            </p>
            <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-[#EADCC4]">
              <span
                className="block h-full rounded-full bg-[#17B0A7] transition-[width] duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px] font-bold text-[#6B7794]">
              <span>
                Module {mod.order + 1} of {course.modules.length}
              </span>
              <span className="tabular-nums">{progressPercent}%</span>
            </div>
          </div>
          <Link
            href="/portal/training"
            className="hidden shrink-0 items-center gap-1 text-xs font-extrabold text-[#6B7794] transition-colors hover:text-[#12235B] sm:inline-flex"
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
      <div className="mt-8">
        <span className="inline-flex items-center rounded-full bg-[#FFC93C] px-4 py-1.5 text-xs font-extrabold uppercase tracking-[1.4px] text-[#12235B]">
          Module {mod.order + 1}
        </span>
        <h1 className="sub-display mt-3 max-w-[780px] text-[34px] leading-[1.08] tracking-[-1px] sm:text-[44px]">
          {mod.title}
        </h1>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-semibold text-[#6B7794]">
          <span className="inline-flex items-center gap-1.5">
            <BookOpen className="h-4 w-4 text-[#17B0A7]" />
            {/* A webinar lesson is often a video and a download with no
                written sections. Counting only text told a paying parent
                "content coming soon" while the video sat above it. */}
            {hasContent
              ? `${mod.content.sections.length} section${mod.content.sections.length === 1 ? "" : "s"}`
              : hasVideo
                ? "Video lesson"
                : (mod.resources?.length ?? 0) > 0
                  ? `${mod.resources!.length} download${mod.resources!.length === 1 ? "" : "s"}`
                  : "Coming soon"}
          </span>
          {hasQuiz && (
            <span className="inline-flex items-center gap-1.5">
              <Award className="h-4 w-4 text-[#E71D57]" />
              {questions.length}-question quiz
            </span>
          )}
          {isCompleted && (
            <span className="inline-flex items-center gap-1.5 rounded-full border-2 border-[#C2E7E3] bg-[#E7F6F4] px-3 py-1 text-[13px] font-bold text-[#12235B]">
              <CheckCircle2 className="h-3.5 w-3.5 text-[#17B0A7]" />
              Completed{mod.score != null ? ` · ${mod.score}%` : ""}
            </span>
          )}
        </div>
      </div>

      {/* Media hero */}
      <div className="mt-6">
        <div className="overflow-hidden rounded-[26px] border-[3px] border-[#12235B] bg-[#FFE9A8]">
          {hasVideo ? (
            <VideoPlayer url={mod.videoUrl!} title={mod.title} />
          ) : mod.coverImageUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={mod.coverImageUrl}
              alt={mod.title}
              className="aspect-[16/7] w-full object-cover"
            />
          ) : (
            <div className="flex aspect-[16/7] items-center justify-center">
              <div className="sub-edge flex h-24 w-24 items-center justify-center rounded-[28px] bg-white text-[#12235B]">
                <BookOpen className="h-10 w-10" />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Handouts that go with this lesson, sitting right under the video
          where a learner looks for them. */}
      {(mod.resources?.length ?? 0) > 0 && (
        <div className="sub-edge mt-6 rounded-[26px] bg-white p-6">
          <h2 className="sub-display text-2xl">Resources</h2>
          <ul className="mt-4 space-y-2">
            {mod.resources!.map((r) => (
              <li key={r.id}>
                <a
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 rounded-[16px] border-2 border-[#F2E9DA] bg-[#FFFCF6] px-4 py-3 text-[15px] font-semibold text-[#12235B] transition-colors hover:border-[#12235B] hover:bg-white"
                >
                  {r.kind === "link" ? (
                    <Link2 className="h-4 w-4 shrink-0 text-[#17B0A7]" />
                  ) : (
                    <Paperclip className="h-4 w-4 shrink-0 text-[#E71D57]" />
                  )}
                  <span className="min-w-0 flex-1 truncate">{r.title}</span>
                  {r.sizeBytes ? (
                    <span className="shrink-0 text-[11px] font-bold text-[#6B7794]">
                      {Math.max(1, Math.round(r.sizeBytes / 1024))} KB
                    </span>
                  ) : null}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Body: lesson or quiz results */}
      {result ? (
        <QuizResults
          result={result}
          questions={questions}
          courseId={courseId}
          nextModule={nextModule && !nextLocked ? nextModule : null}
          onRetry={handleRetry}
          retrying={retrying}
          onReview={() => setResult(null)}
        />
      ) : (
        <>
          {/* Lesson body */}
          <div className="mx-auto max-w-[760px] py-10 text-[#3D4A6B]">
            {hasContent ? (
              <LessonBody sections={mod.content.sections as LessonSection[]} />
            ) : hasVideo || (mod.resources?.length ?? 0) > 0 ? null : (
              /* Only when there is genuinely nothing — no text, no video,
                 no downloads. */
              <LessonEmptyState moduleTitle={mod.title} hasQuiz={hasQuiz} />
            )}
          </div>

          {/* Quiz (only when there is one and we're not already complete) */}
          {hasQuiz && !isCompleted && (
            <div className="mx-auto max-w-[760px] pb-32">
              <div className="mb-5 flex items-center gap-2.5">
                <Sparkles className="h-5 w-5 text-[#E71D57]" />
                <h2 className="sub-display text-2xl">Check your understanding</h2>
              </div>
              <div className="space-y-4">
                {questions.map((q, qi) => (
                  <div key={q.id} className="sub-edge rounded-[26px] bg-white p-6 sm:p-7">
                    <span className="inline-flex items-center rounded-full border-2 border-[#F3DFA6] bg-[#FFF3D2] px-3 py-1 text-[13px] font-bold text-[#12235B]">
                      Question {qi + 1}
                    </span>
                    <p className="sub-display mt-3 mb-4 text-[19px] leading-snug">
                      {q.text}
                    </p>
                    <div className="space-y-2">
                      {q.options.map((opt, oi) => {
                        const active = answers[qi] === oi;
                        return (
                          <button
                            type="button"
                            key={oi}
                            onClick={() => handleAnswer(qi, oi)}
                            className={`flex w-full items-center gap-3 rounded-[18px] border-[3px] px-4 py-3.5 text-left text-[15px] font-semibold text-[#12235B] transition-colors ${
                              active
                                ? "border-[#12235B] bg-[#E7F6F4]"
                                : "border-[#D9D2C4] bg-[#FFFCF6] hover:border-[#12235B] hover:bg-white"
                            }`}
                          >
                            <span
                              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px] text-xs font-extrabold ${
                                active
                                  ? "bg-[#12235B] text-white"
                                  : "bg-[#EADCC4] text-[#3D4A6B]"
                              }`}
                            >
                              {String.fromCharCode(65 + oi)}
                            </span>
                            <span className="flex-1">{opt}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes toggle */}
          {!hasQuiz && !isCompleted && (
            <div className="mx-auto max-w-[760px] pb-32">
              <button
                type="button"
                onClick={() => setShowNotes((v) => !v)}
                className="sub-edge sub-press flex w-full items-center justify-between rounded-[22px] bg-white px-5 py-3.5 text-[15px] font-extrabold text-[#12235B]"
              >
                <span>Your notes</span>
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${showNotes ? "rotate-180" : ""}`}
                />
              </button>
              {showNotes && (
                <div className="sub-edge mt-4 rounded-[26px] bg-white p-4 sm:p-5">
                  <NotesPanel moduleId={moduleId} />
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Sticky bottom action bar */}
      {!result && (
        <footer className="fixed inset-x-0 bottom-0 z-30 border-t-[3px] border-[#12235B] bg-[#FFF8EC]/95 backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3.5 sm:px-6">
            {prevModule ? (
              <Link
                href={`/portal/training/${courseId}/${prevModule.id}`}
                className={btnOutline}
              >
                <ArrowLeft className="h-4 w-4" />
                Previous
              </Link>
            ) : (
              <Link href={`/portal/training/${courseId}`} className={btnOutline}>
                <ArrowLeft className="h-4 w-4" />
                Overview
              </Link>
            )}

            <div className="flex-1" />

            {hasQuiz && !isCompleted ? (
              <button
                type="button"
                className={btnPrimary}
                style={pinkBg}
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
                  className={btnPrimary}
                  style={pinkBg}
                >
                  Next module
                  <ArrowRight className="h-4 w-4" />
                </Link>
              ) : (
                <Link
                  href={`/portal/training/${courseId}`}
                  className={btnPrimary}
                  style={pinkBg}
                >
                  Back to course
                  <ArrowRight className="h-4 w-4" />
                </Link>
              )
            ) : (
              // Content-only module: offer mark-complete
              <button
                type="button"
                className={btnPrimary}
                style={pinkBg}
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
    <div className="mx-auto mt-8 max-w-[760px]">
      <div
        className={`sub-edge-lg rounded-[30px] px-8 py-10 text-center ${
          result.passed ? "bg-[#E7F6F4]" : "bg-[#FFE7EE]"
        }`}
      >
        {result.passed ? (
          <CheckCircle2 className="mx-auto mb-3 h-14 w-14 text-[#17B0A7]" />
        ) : (
          <XCircle className="mx-auto mb-3 h-14 w-14 text-[#E71D57]" />
        )}
        <p className="sub-display text-5xl leading-none tabular-nums">
          {result.score}%
        </p>
        <p className="mt-2 text-[15px] font-extrabold text-[#12235B]">
          {result.passed
            ? "Passed — well done!"
            : "Not quite — 80% needed to pass"}
        </p>
        <p className="mt-2 text-xs font-bold text-[#6B7794]">
          Attempt {result.attempts}
        </p>
      </div>

      <div className="mt-6 space-y-3">
        {result.feedback.map((fb, i) => {
          const q = questions[i];
          return (
            <div
              key={fb.questionId}
              className={`rounded-[22px] border-[3px] bg-white p-5 ${
                fb.isCorrect ? "border-[#C2E7E3]" : "border-[#FBC7D7]"
              }`}
            >
              <p className="sub-display text-[17px] leading-snug">
                <span className="mr-1">Q{i + 1}.</span> {q.text}
              </p>
              <div className="mt-3 space-y-1">
                {q.options.map((opt, oi) => (
                  <div
                    key={oi}
                    className={`flex items-center gap-2 rounded-[12px] px-3 py-1.5 text-sm ${
                      oi === fb.correctIndex
                        ? "bg-[#E7F6F4] font-extrabold text-[#12235B]"
                        : oi === fb.selected && !fb.isCorrect
                          ? "bg-[#FFE7EE] font-semibold text-[#E71D57] line-through"
                          : "font-semibold text-[#6B7794]"
                    }`}
                  >
                    {oi === fb.correctIndex && (
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#17B0A7]" />
                    )}
                    {oi === fb.selected && !fb.isCorrect && (
                      <XCircle className="h-3.5 w-3.5 shrink-0 text-[#E71D57]" />
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
              className={`${btnPrimary} flex-1 justify-center`}
              style={pinkBg}
            >
              Next module
              <ArrowRight className="h-4 w-4" />
            </Link>
          ) : (
            <Link
              href={`/portal/training/${courseId}`}
              className={`${btnPrimary} flex-1 justify-center`}
              style={pinkBg}
            >
              Back to course
              <ArrowRight className="h-4 w-4" />
            </Link>
          )
        ) : (
          <>
            <button
              type="button"
              className={btnOutline}
              onClick={onReview}
            >
              Review lesson
            </button>
            <button
              type="button"
              onClick={onRetry}
              disabled={retrying}
              className={`${btnPrimary} flex-1 justify-center`}
              style={pinkBg}
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
