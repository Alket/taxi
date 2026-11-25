type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()
const MAX_BUCKETS = 10_000
const PRUNE_INTERVAL_MS = 60_000
let lastPruneAt = 0

function pruneExpiredBuckets(now: number) {
  if (now - lastPruneAt < PRUNE_INTERVAL_MS && buckets.size < MAX_BUCKETS) {
    return
  }
  lastPruneAt = now
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) {
      buckets.delete(key)
    }
  }
  // Hard cap: evict oldest entries if still above limit under sustained spraying.
  while (buckets.size >= MAX_BUCKETS) {
    const oldestKey = buckets.keys().next().value
    if (oldestKey === undefined) break
    buckets.delete(oldestKey)
  }
}

/**
 * Simple in-process fixed-window rate limiter.
 *
 * Intended for a single Node process (typical Docker one-replica deploy).
 * Limits are not shared across replicas — do not scale horizontally without an
 * external store (Redis etc.) or sticky routing plus accepting per-instance caps.
 */
export function takeRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { ok: true } | { ok: false; retryAfterSec: number } {
  const now = Date.now()
  pruneExpiredBuckets(now)
  let bucket = buckets.get(key)
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + windowMs }
    buckets.set(key, bucket)
  }
  if (bucket.count >= limit) {
    return {
      ok: false,
      retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    }
  }
  bucket.count += 1
  return { ok: true }
}
