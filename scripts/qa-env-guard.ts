/**
 * Refuse QA scripts that mutate DB / hit HTTP against non-local targets
 * unless QA_ALLOW_REMOTE=1 is set explicitly.
 */
import { existsSync } from "fs"

const LOCAL_HOST =
  /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]|host\.docker\.internal|app|db)(:\d+)?$/i

function hostnameOfUrl(raw: string): string | null {
  try {
    return new URL(raw).hostname
  } catch {
    return null
  }
}

function isLocalHostname(host: string | null): boolean {
  if (!host) return false
  if (LOCAL_HOST.test(host)) return true
  // Docker compose service names used on the internal network.
  if (host === "app" || host === "db") return true
  return false
}

function isLocalDatabaseUrl(url: string): boolean {
  try {
    const u = new URL(url)
    return isLocalHostname(u.hostname)
  } catch {
    // postgres://user:pass@host:port/db — URL() may fail on some forms
    const m = url.match(/@([^/:?]+)(?::\d+)?\//)
    return isLocalHostname(m?.[1] ?? null)
  }
}

/**
 * Call after resolving QA_BASE_URL / DATABASE_URL (and docker host remaps).
 * Exits process with code 1 if the target looks remote and QA_ALLOW_REMOTE≠1.
 */
export function assertQaLocalOrAllowed(opts: {
  baseUrl: string
  databaseUrl?: string
}): void {
  if (process.env.QA_ALLOW_REMOTE === "1") return

  const problems: string[] = []
  const host = hostnameOfUrl(opts.baseUrl)
  if (!isLocalHostname(host)) {
    problems.push(
      `QA_BASE_URL host "${host ?? opts.baseUrl}" is not local`,
    )
  }

  const dbUrl = opts.databaseUrl ?? process.env.DATABASE_URL
  if (dbUrl && !isLocalDatabaseUrl(dbUrl)) {
    problems.push("DATABASE_URL host is not local")
  }

  // Extra safety: common prod markers in the connection string.
  if (
    dbUrl &&
    /production|prod-|rds\.amazonaws|\.neon\.tech|supabase\.co|railway\.app|render\.com/i.test(
      dbUrl,
    ) &&
    process.env.QA_ALLOW_REMOTE !== "1"
  ) {
    problems.push("DATABASE_URL looks like a hosted/production database")
  }

  if (problems.length === 0) return

  console.error(
    [
      "QA refused to run: target is not local.",
      ...problems.map((p) => `  - ${p}`),
      "Set QA_ALLOW_REMOTE=1 only if you intentionally target this environment.",
    ].join("\n"),
  )
  process.exit(1)
}

export function runningInDockerEnv(): boolean {
  return existsSync("/.dockerenv")
}
