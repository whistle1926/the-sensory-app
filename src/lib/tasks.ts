export const VALID_PRIORITIES = new Set(["low", "medium", "high", "urgent"]);

/**
 * 5-stage workflow:
 *
 *   todo         → 🔴 New — just logged, not yet picked up
 *   in_progress  → 🟡 In Progress — Paddy actively building
 *   for_review   → 🟣 For Review — Paddy done, Grace verifies
 *   done         → ✅ Completed — Grace has signed off
 *   deferred     → ⚪ Deferred — parked for now, not in this round
 *
 * "for_review" and "deferred" are new in May 2026 — older rows that
 * pre-date them stay on the original 3 statuses and continue to work.
 */
export const VALID_STATUSES = new Set([
  "todo",
  "in_progress",
  "for_review",
  "done",
  "deferred",
]);

export type TaskPriority = "low" | "medium" | "high" | "urgent";

export type TaskStatus =
  | "todo"
  | "in_progress"
  | "for_review"
  | "done"
  | "deferred";

export const PRIORITY_LABEL: Record<TaskPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

export const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: "New",
  in_progress: "In Progress",
  for_review: "For Review",
  done: "Completed",
  deferred: "Deferred",
};
