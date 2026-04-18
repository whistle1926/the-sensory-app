import { BookOpen, Sparkles } from "lucide-react";

interface Props {
  moduleTitle: string;
  /** Shown when true — tells the reader a quiz will unlock this module
   *  once content lands. False hides the line. */
  hasQuiz: boolean;
}

/**
 * Empty state for modules that have no authored content yet. Instead of a
 * blank white area that looks broken, shows a friendly "content on the
 * way" card so the parent knows this is in progress (and it feels like
 * part of the product).
 */
export function LessonEmptyState({ moduleTitle, hasQuiz }: Props) {
  return (
    <div className="lp-empty">
      <div className="lp-empty-card">
        <div className="lp-empty-icon">
          <BookOpen className="h-7 w-7" />
        </div>
        <h2>Content coming soon</h2>
        <p>
          <span className="font-semibold text-foreground">{moduleTitle}</span>{" "}
          is being prepared by your therapist. We&apos;ll email you when it
          unlocks — typically within a few days of enrolling.
        </p>
        <div
          className="mt-5 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold"
          style={{ color: "var(--primary)" }}
        >
          <Sparkles className="h-3.5 w-3.5" />
          {hasQuiz
            ? "A short quiz will unlock with the lesson"
            : "In the meantime, your progress is saved"}
        </div>
      </div>
    </div>
  );
}
