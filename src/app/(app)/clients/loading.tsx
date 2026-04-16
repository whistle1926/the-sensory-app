export default function ClientsLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="h-7 w-28 animate-pulse rounded-lg bg-muted" />
          <div className="mt-2 h-4 w-20 animate-pulse rounded-lg bg-muted" />
        </div>
        <div className="h-9 w-28 animate-pulse rounded-xl bg-muted" />
      </div>

      {/* Search bar */}
      <div className="h-10 w-full animate-pulse rounded-lg bg-muted" />

      {/* Filter pills */}
      <div className="flex gap-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-7 w-20 animate-pulse rounded-full bg-muted" />
        ))}
      </div>

      {/* Table skeleton */}
      <div className="rounded-2xl border border-border bg-card shadow-[var(--shadow-sm)] overflow-hidden">
        <div className="hidden sm:block">
          <div className="border-b border-border bg-muted/30 px-5 py-3 flex gap-8">
            {["w-24", "w-20", "w-16", "w-28", "w-20"].map((w, i) => (
              <div key={i} className={`h-3 ${w} animate-pulse rounded bg-muted`} />
            ))}
          </div>
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex gap-8 border-b border-border px-5 py-3">
              <div className="h-4 w-32 animate-pulse rounded bg-muted" />
              <div className="h-4 w-20 animate-pulse rounded bg-muted" />
              <div className="h-4 w-16 animate-pulse rounded bg-muted" />
              <div className="h-4 w-28 animate-pulse rounded bg-muted" />
              <div className="h-7 w-28 animate-pulse rounded-lg bg-muted" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
