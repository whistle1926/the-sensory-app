export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div>
          <div className="h-7 w-36 animate-pulse rounded-lg bg-muted" />
          <div className="mt-2 h-4 w-56 animate-pulse rounded-lg bg-muted" />
        </div>
        <div className="h-9 w-32 animate-pulse rounded-xl bg-muted" />
      </div>

      {/* Stat cards skeleton */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2].map((i) => (
          <div
            key={i}
            className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-sm)]"
          >
            <div className="flex items-center justify-between">
              <div className="h-4 w-24 animate-pulse rounded bg-muted" />
              <div className="h-10 w-10 animate-pulse rounded-xl bg-muted" />
            </div>
            <div className="mt-3 h-8 w-16 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>

      {/* Recent section skeleton */}
      <div>
        <div className="h-4 w-32 animate-pulse rounded bg-muted" />
        <div className="mt-3 space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-sm)]"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="h-4 w-32 animate-pulse rounded bg-muted" />
                  <div className="mt-2 h-3 w-20 animate-pulse rounded bg-muted" />
                </div>
                <div className="h-5 w-5 animate-pulse rounded bg-muted" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
