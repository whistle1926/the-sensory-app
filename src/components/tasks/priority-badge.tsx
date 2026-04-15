import { cn } from "@/lib/utils";
import type { TaskPriority } from "@/lib/tasks";

const STYLES: Record<TaskPriority, string> = {
  low: "bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-400",
  medium:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-950/50 dark:text-yellow-300",
  high: "bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-400",
  urgent: "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400",
};

const LABELS: Record<TaskPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

export function PriorityBadge({
  priority,
  className,
}: {
  priority: TaskPriority;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold",
        STYLES[priority],
        className
      )}
    >
      {LABELS[priority]}
    </span>
  );
}

const STATUS_STYLES: Record<string, string> = {
  todo: "bg-muted text-muted-foreground",
  in_progress: "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400",
  done: "bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-400",
};

const STATUS_LABELS: Record<string, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  done: "Done",
};

export function StatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold",
        STATUS_STYLES[status] ?? STATUS_STYLES.todo,
        className
      )}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}
