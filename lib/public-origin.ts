/**
 * Resolves the publicly reachable site origin for redirects (PayPal return/cancel).
 *
 * Browsers cannot open `http://0.0.0.0:...` (ERR_ADDRESS_INVALID). That host is
 * only a server bind address, so we rewrite it (and IPv6 equivalents) to localhost
 * when building callback URLs from the request.
 */
export function getPublicOrigin(request: Request): string {
  const fromEnv = (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    ""
  ).trim()
  if (fromEnv) {
    try {
      return new URL(fromEnv).origin
    } catch {
      // fall through
    }
  }

  const originHeader = request.headers.get("origin")
  if (originHeader) {
    try {
      return normalizeLocalOrigin(new URL(originHeader).origin)
    } catch {
      // fall through
    }
  }

  const forwardedHost = request.headers.get("x-forwarded-host")
  const forwardedProto = request.headers.get("x-forwarded-proto")
  if (forwardedHost) {
    const host = forwardedHost.split(",")[0]?.trim()
    if (host) {
      const proto =
        forwardedProto?.split(",")[0]?.trim() ||
        (host.includes("localhost") || host.startsWith("127.")
          ? "http"
          : "https")
      return normalizeLocalOrigin(`${proto}://${host}`)
    }
  }

  const host = request.headers.get("host")
  if (host) {
    const proto = new URL(request.url).protocol.replace(":", "") || "http"
    return normalizeLocalOrigin(`${proto}://${host}`)
  }

  return normalizeLocalOrigin(new URL(request.url).origin)
}

function normalizeLocalOrigin(origin: string): string {
  try {
    const url = new URL(origin)
    if (
      url.hostname === "0.0.0.0" ||
      url.hostname === "[::]" ||
      url.hostname === "::" ||
      url.hostname === "[::1]"
    ) {
      url.hostname = "localhost"
    }
    return url.origin
  } catch {
    return origin.replace("://0.0.0.0", "://localhost").replace("://[::]", "://localhost")
  }
}
