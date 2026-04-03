"use client";

import { use, useEffect, useState, useCallback } from "react";
import { ArrowLeft, CheckCircle2, XCircle, ArrowRight, RotateCcw, BookOpen } from "lucide-react";
import Link from "next/link";

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
  status: "IN_PROGRESS" | "COMPLETED" | "FAILED";
  score: number | null;
  attempts: number;
}

interface QuizResult {
  score: number;
  passed: boolean;
  feedback: { questionId: string; isCorrect: boolean; correctIndex: number; selected: number }[];
  status: string;
  attempts: number;
}

type View = "lesson" | "quiz" | "results";

export default function ModulePage({ params }: { params: Promise<{ courseId: string; moduleId: string }> }) {
  const { courseId, moduleId } = use(params);
  const [mod, setMod] = useState<ModuleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>("lesson");
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<QuizResult | null>(null);
  const [retrying, setRetrying] = useState(false);

  const loadModule = useCallback(() => {
    setLoading(true);
    fetch(`/api/courses/${courseId}/modules/${moduleId}`)
      .then((r) => r.json())
      .then((data) => {
        setMod(data);
        if (data.status === "COMPLETED") {
          setView("lesson");
        } else if (data.status === "FAILED") {
          setView("lesson");
        }
        setLoading(false);
      });
  }, [courseId, moduleId]);

  useEffect(() => { loadModule(); }, [loadModule]);

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

  const allAnswered = mod.questions.length > 0 && answers.length === mod.questions.length && answers.every((a) => a !== null);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div>
        <Link
          href={`/training/${courseId}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors mb-3"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Course
        </Link>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary">
            <span className="text-sm font-bold text-primary">{mod.order}</span>
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">{mod.title}</h1>
            {mod.status === "COMPLETED" && (
              <p className="text-xs text-green-600 font-semibold">Completed — Score: {mod.score}%</p>
            )}
          </div>
        </div>
      </div>

      {/* View Tabs */}
      {mod.status !== "COMPLETED" && (
        <div className="flex gap-1 rounded-xl bg-muted p-1">
          <button
            onClick={() => setView("lesson")}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
              view === "lesson"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <BookOpen className="mr-1.5 inline h-4 w-4" />
            Lesson
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

      {/* LESSON VIEW */}
      {view === "lesson" && (
        <div className="space-y-6">
          {mod.content.sections.map((section, i) => (
            <div key={i} className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              {section.heading && (
                <h2 className="text-lg font-bold text-foreground mb-3">{section.heading}</h2>
              )}
              <div className="text-sm leading-relaxed text-foreground/80 whitespace-pre-wrap">{section.body}</div>
            </div>
          ))}

          {mod.status !== "COMPLETED" && (
            <button
              onClick={() => {
                setView("quiz");
                if (answers.length === 0) setAnswers(new Array(mod.questions.length).fill(null));
              }}
              className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary/80"
            >
              Take Quiz
              <ArrowRight className="ml-2 inline h-4 w-4" />
            </button>
          )}
        </div>
      )}

      {/* QUIZ VIEW */}
      {view === "quiz" && (
        <div className="space-y-4">
          {mod.questions.map((q, qi) => (
            <div key={q.id} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <p className="font-semibold text-foreground">
                <span className="text-primary mr-2">Q{qi + 1}.</span>
                {q.text}
              </p>
              <div className="mt-3 space-y-2">
                {q.options.map((opt, oi) => (
                  <button
                    key={oi}
                    onClick={() => handleAnswer(qi, oi)}
                    className={`w-full rounded-xl border px-4 py-3 text-left text-sm transition-all ${
                      answers[qi] === oi
                        ? "border-primary bg-secondary text-foreground font-medium"
                        : "border-border hover:border-primary/30 text-foreground/80"
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
            className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary/80 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "Submitting..." : "Submit Answers"}
          </button>
        </div>
      )}

      {/* RESULTS VIEW */}
      {view === "results" && result && (
        <div className="space-y-4">
          <div className={`rounded-2xl p-6 text-center ${
            result.passed
              ? "bg-green-50 dark:bg-green-950/50 border border-green-200"
              : "bg-red-50 dark:bg-red-950/50 border border-red-200"
          }`}>
            {result.passed ? (
              <CheckCircle2 className="mx-auto h-12 w-12 text-green-600 mb-3" />
            ) : (
              <XCircle className="mx-auto h-12 w-12 text-red-500 mb-3" />
            )}
            <p className="text-2xl font-bold tracking-tight">
              {result.score}%
            </p>
            <p className={`text-sm font-semibold mt-1 ${result.passed ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}`}>
              {result.passed ? "Passed! Well done." : "Not quite — you need 80% to pass."}
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Attempt {result.attempts}
            </p>
          </div>

          {/* Per-question feedback */}
          {result.feedback.map((fb, i) => {
            const q = mod.questions[i];
            return (
              <div key={fb.questionId} className={`rounded-2xl border p-4 ${
                fb.isCorrect
                  ? "border-green-200 bg-green-50/50 dark:bg-green-950/50"
                  : "border-red-200 bg-red-50/50 dark:bg-red-950/50"
              }`}>
                <p className="font-semibold text-sm text-foreground">
                  <span className="mr-1">Q{i + 1}.</span> {q.text}
                </p>
                <div className="mt-2 space-y-1">
                  {q.options.map((opt, oi) => (
                    <div key={oi} className={`flex items-center gap-2 text-sm rounded-lg px-3 py-1.5 ${
                      oi === fb.correctIndex
                        ? "text-green-700 font-semibold"
                        : oi === fb.selected && !fb.isCorrect
                          ? "text-red-600 line-through"
                          : "text-muted-foreground"
                    }`}>
                      {oi === fb.correctIndex && <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" />}
                      {oi === fb.selected && !fb.isCorrect && <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />}
                      {oi !== fb.correctIndex && oi !== fb.selected && <span className="w-3.5" />}
                      <span>{String.fromCharCode(65 + oi)}. {opt}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Action buttons */}
          <div className="flex gap-3">
            {result.passed ? (
              <Link
                href={`/training/${courseId}`}
                className="flex-1 rounded-xl bg-primary px-4 py-3 text-center text-sm font-semibold text-white transition-colors hover:bg-primary/80"
              >
                <ArrowRight className="mr-2 inline h-4 w-4" />
                Back to Course
              </Link>
            ) : (
              <button
                onClick={handleRetry}
                disabled={retrying}
                className="flex-1 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary/80 disabled:opacity-50"
              >
                <RotateCcw className="mr-2 inline h-4 w-4" />
                {retrying ? "Resetting..." : "Try Again"}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
