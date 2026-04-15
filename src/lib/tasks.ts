export const VALID_PRIORITIES = new Set(["low", "medium", "high", "urgent"]);
export const VALID_STATUSES = new Set(["todo", "in_progress", "done"]);

export type TaskPriority = "low" | "medium" | "high" | "urgent";
export type TaskStatus = "todo" | "in_progress" | "done";

export const PRIORITY_LABEL: Record<TaskPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

export const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  done: "Done",
};
