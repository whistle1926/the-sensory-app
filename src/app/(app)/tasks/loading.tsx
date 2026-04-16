export default function TasksLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="h-7 w-24 animate-pulse rounded-lg bg-muted" />
          <div className="mt-2 h-4 w-36 animate-pulse rounded-lg bg-muted" />
        </div>
        <div className="h-9 w-28 animate-pulse rounded-xl bg-muted" />
      </div>

      {/* Filter bar */}
      <div className="flex gap-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-8 w-20 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>

      {/* Task cards */}
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-sm)]"
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="h-4 w-48 animate-pulse rounded bg-muted" />
                <div className="mt-2 h-3 w-32 animate-pulse rounded bg-muted" />
              </div>
              <div className="h-6 w-16 animate-pulse rounded-full bg-muted" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
