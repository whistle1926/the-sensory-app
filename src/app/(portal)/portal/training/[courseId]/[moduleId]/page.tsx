"use client";

import { use, useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  XCircle,
  RotateCcw,
  BookOpen,
  ClipboardList,
  NotebookPen,
} from "lucide-react";
import {
  CourseOutlineSidebar,
  type OutlineModule,
} from "@/components/training/course-outline-sidebar";
import { VideoPlayer } from "@/components/training/video-player";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import { NotesPanel } from "@/components/training/notes-panel";
import { LessonNavBar } from "@/components/training/lesson-nav-bar";

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
  modules: OutlineModule[];
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

type Tab = "lesson" | "quiz" | "notes";

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
  const [tab, setTab] = useState<Tab>("lesson");
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

  // Reset transient UI when navigating between modules.
  useEffect(() => {
    setTab("lesson");
    setAnswers([]);
    setResult(null);
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
      }
    );
    const data = await res.json();
    setResult(data);
    setSubmitting(false);
    if (data?.passed) {
      // Refresh outline so the sidebar reflects the new state.
      fetch(`/api/courses/${courseId}`)
        .then((r) => r.json())
        .then((courseData) =>
          setCourse({
            id: courseData.id,
            title: courseData.title,
            modules: courseData.modules ?? [],
          })
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
    setTab("quiz");
  };

  if (loading || !mod || !course) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const hasQuiz = mod.questions.length > 0;
  const isCompleted = mod.status === "COMPLETED";
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
    (m) => m.status === "COMPLETED"
  ).length;

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
      <CourseOutlineSidebar
        courseId={course.id}
        courseTitle={course.title}
        modules={course.modules}
        currentModuleId={moduleId}
        completedCount={completedCount}
        totalCount={course.modules.length}
      />

      <div className="mx-auto w-full max-w-3xl space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary">
            <span className="text-sm font-bold text-primary">{mod.order}</span>
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">{mod.title}</h1>
            {isCompleted && (
              <p className="text-xs font-semibold text-green-600">
                Completed — Score: {mod.score}%
              </p>
            )}
          </div>
        </div>

        {mod.videoUrl && <VideoPlayer url={mod.videoUrl} title={mod.title} />}

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
          <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
            <TabsList className="w-full">
              <TabsTrigger value="lesson">
                <BookOpen /> Lesson
              </TabsTrigger>
              {hasQuiz && !isCompleted && (
                <TabsTrigger value="quiz">
                  <ClipboardList /> Quiz
                </TabsTrigger>
              )}
              <TabsTrigger value="notes">
                <NotebookPen /> Notes
              </TabsTrigger>
            </TabsList>

            <TabsContent value="lesson" className="space-y-6">
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

              {!isCompleted && hasQuiz && (
                <button
                  onClick={() => {
                    setTab("quiz");
                    if (answers.length === 0)
                      setAnswers(new Array(mod.questions.length).fill(null));
                  }}
                  className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary/80"
                >
                  Take quiz <ArrowRight className="ml-2 inline h-4 w-4" />
                </button>
              )}
            </TabsContent>

            {hasQuiz && !isCompleted && (
              <TabsContent value="quiz" className="space-y-4">
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
                  {submitting ? "Submitting..." : "Submit answers"}
                </button>
              </TabsContent>
            )}

            <TabsContent value="notes">
              <NotesPanel moduleId={moduleId} />
            </TabsContent>
          </Tabs>
        )}

        <LessonNavBar
          courseId={courseId}
          prev={prevModule}
          next={nextModule}
          nextLocked={!!nextLocked}
        />
      </div>
    </div>
  );
}

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
  nextModule: OutlineModule | null;
  onRetry: () => void;
  retrying: boolean;
  onReview: () => void;
}) {
  return (
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
          {result.passed
            ? "Passed! Well done."
            : "Not quite — you need 80% to pass."}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Attempt {result.attempts}
        </p>
      </div>

      {result.feedback.map((fb, i) => {
        const q = questions[i];
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

      <div className="flex gap-3">
        {result.passed ? (
          nextModule ? (
            <Link
              href={`/portal/training/${courseId}/${nextModule.id}`}
              className="flex-1 rounded-xl bg-primary px-4 py-3 text-center text-sm font-semibold text-white transition-colors hover:bg-primary/80"
            >
              Next module <ArrowRight className="ml-2 inline h-4 w-4" />
            </Link>
          ) : (
            <Link
              href={`/portal/training/${courseId}`}
              className="flex-1 rounded-xl bg-primary px-4 py-3 text-center text-sm font-semibold text-white transition-colors hover:bg-primary/80"
            >
              Back to course <ArrowRight className="ml-2 inline h-4 w-4" />
            </Link>
          )
        ) : (
          <>
            <button
              onClick={onReview}
              className="rounded-xl border border-border bg-background px-4 py-3 text-sm font-semibold transition-colors hover:bg-muted"
            >
              Review lesson
            </button>
            <button
              onClick={onRetry}
              disabled={retrying}
              className="flex-1 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary/80 disabled:opacity-50"
            >
              <RotateCcw className="mr-2 inline h-4 w-4" />
              {retrying ? "Resetting..." : "Try again"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
