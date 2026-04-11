import "server-only";

/**
 * In-memory token bucket rate limiter for the submissions API.
 * Good enough for MVP; step 12.5 swaps this for Upstash Redis so
 * limits survive across instances and region replicas.
 *
 * Two concurrent buckets per key:
 *   - `burst`  (10 requests / 10 seconds)
 *   - `steady` (60 requests / hour)
 *
 * The key is typically `${ip}:${formId}` so one bot can't block a
 * whole workspace by hammering a single form.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const burstBuckets = new Map<string, Bucket>();
const steadyBuckets = new Map<string, Bucket>();

const BURST_LIMIT = 10;
const BURST_WINDOW_MS = 10_000;

const STEADY_LIMIT = 60;
const STEADY_WINDOW_MS = 60 * 60 * 1000;

export interface RateLimitResult {
  readonly ok: boolean;
  readonly retryAfterMs: number;
  readonly reason?: "burst" | "steady";
}

export function checkRateLimit(key: string): RateLimitResult {
  const now = Date.now();
  const burst = checkBucket(burstBuckets, key, BURST_LIMIT, BURST_WINDOW_MS, now);
  if (!burst.ok) return { ok: false, retryAfterMs: burst.retryAfterMs, reason: "burst" };
  const steady = checkBucket(steadyBuckets, key, STEADY_LIMIT, STEADY_WINDOW_MS, now);
  if (!steady.ok) return { ok: false, retryAfterMs: steady.retryAfterMs, reason: "steady" };
  return { ok: true, retryAfterMs: 0 };
}

function checkBucket(
  store: Map<string, Bucket>,
  key: string,
  limit: number,
  windowMs: number,
  now: number,
): { ok: boolean; retryAfterMs: number } {
  const existing = store.get(key);
  if (!existing || existing.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterMs: 0 };
  }
  if (existing.count >= limit) {
    return { ok: false, retryAfterMs: existing.resetAt - now };
  }
  existing.count += 1;
  return { ok: true, retryAfterMs: 0 };
}

// Exposed for unit tests so we can reset state between cases.
export function __resetRateLimits(): void {
  burstBuckets.clear();
  steadyBuckets.clear();
}
