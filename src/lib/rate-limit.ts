/**
 * Lightweight in-memory rate limiter.
 *
 * Good enough for a single-instance Vercel deployment: when there's
 * more than one warm function instance, the limit becomes a *per-
 * instance* limit rather than a global one — still useful for
 * protecting expensive third-party calls (Claude, FireBuddy) from a
 * compromised session bursting requests, but not a security boundary.
 *
 * The same pattern lives inline in `/api/courses/checkout` and
 * `/api/forms/public/[slug]/submit`. This is the shared version.
 *
 * Buckets are keyed by an arbitrary string — for staff endpoints we
 * key by user id (so one chatty staff member can't DoS a colleague),
 * for public endpoints we key by IP.
 */

interface Limit {
  /** Max hits allowed inside `windowMs`. */
  max: number;
  /** Sliding-window length in milliseconds. */
  windowMs: number;
}

interface Result {
  ok: boolean;
  /** Seconds the caller should wait before trying again. Only set when ok=false. */
  retryAfter?: number;
}

/**
 * One bucket per (namespace + key). Different endpoints have
 * different namespaces so e.g. an "invoice.send" hit doesn't count
 * against the "report.generate" limit for the same user.
 */
const BUCKETS = new Map<string, number[]>();

export function rateLimit(
  namespace: string,
  key: string,
  limit: Limit,
): Result {
  const now = Date.now();
  const bucketKey = `${namespace}::${key}`;
  const arr = (BUCKETS.get(bucketKey) ?? []).filter(
    (t) => now - t < limit.windowMs,
  );
  if (arr.length >= limit.max) {
    return {
      ok: false,
      retryAfter: Math.ceil((arr[0] + limit.windowMs - now) / 1000),
    };
  }
  arr.push(now);
  BUCKETS.set(bucketKey, arr);
  return { ok: true };
}

/**
 * Helper that returns a Response when limit is exceeded, or null
 * when the caller may proceed. Lets the route handler stay flat:
 *
 *   const blocked = rateLimitOrReject("report.generate", session.user.id, ...);
 *   if (blocked) return blocked;
 */
export function rateLimitOrReject(
  namespace: string,
  key: string,
  limit: Limit,
): Response | null {
  const { ok, retryAfter } = rateLimit(namespace, key, limit);
  if (ok) return null;
  return new Response(
    JSON.stringify({
      error: `Too many requests — please wait ${retryAfter ?? 60}s and try again.`,
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(retryAfter ?? 60),
      },
    },
  );
}
