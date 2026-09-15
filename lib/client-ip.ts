/**
 * Client IP for rate limiting.
 *
 * When TRUST_PROXY is set, prefer X-Real-IP (nginx `$remote_addr`) then the
 * hop TRUST_PROXY_HOPS from the right of X-Forwarded-For.
 *
 * When TRUST_PROXY is unset, ignore XFF (spoofable) and use a fixed `"direct"`
 * bucket. Do not fingerprint User-Agent / Accept-Language — clients can rotate
 * those headers to mint unlimited rate-limit keys.
 *
 * Production behind a reverse proxy should set TRUST_PROXY=1.
 */
export function clientIpFromRequest(request: Request): string {
  const trustProxy =
    process.env.TRUST_PROXY === "1" ||
    process.env.TRUST_PROXY === "true" ||
    process.env.TRUST_PROXY === "yes"

  if (trustProxy) {
    const realIp = request.headers.get("x-real-ip")?.trim()
    if (realIp) return realIp.slice(0, 64)

    const forwarded = request.headers.get("x-forwarded-for")
    if (forwarded) {
      const parts = forwarded
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean)
      if (parts.length > 0) {
        const hops = Math.max(
          1,
          Number(process.env.TRUST_PROXY_HOPS || "1") || 1,
        )
        const idx = Math.max(0, parts.length - hops)
        const chosen = parts[idx] || parts[parts.length - 1]
        if (chosen) return chosen.slice(0, 64)
      }
    }
  }

  return "direct"
}
