import dns from "node:dns/promises"
import net from "node:net"

/** Common submission ports only — blocks SSRF to Redis/MySQL/etc. */
export const ALLOWED_SMTP_PORTS = new Set([25, 465, 587, 2465, 2525, 2587])

const BLOCKED_HOST_EXACT = new Set([
  "localhost",
  "localhost.localdomain",
  "ip6-localhost",
  "ip6-loopback",
  "metadata.google.internal",
  "metadata.goog",
  "kubernetes.default",
  "kubernetes.default.svc",
])

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".").map((p) => Number(p))
  if (
    parts.length !== 4 ||
    parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)
  ) {
    return null
  }
  return (
    ((parts[0]! << 24) >>> 0) +
    ((parts[1]! << 16) >>> 0) +
    ((parts[2]! << 8) >>> 0) +
    (parts[3]! >>> 0)
  )
}

function isPrivateOrReservedIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const n = ipv4ToInt(ip)
    if (n == null) return true
    // 0.0.0.0/8, 10/8, 127/8, 169.254/16, 172.16/12, 192.168/16,
    // 100.64/10 (CGNAT), 192.0.0/24, 192.0.2/24, 198.18/15, 198.51.100/24,
    // 203.0.113/24, 224/4 (multicast), 240/4 (reserved)
    if (n >= 0x00000000 && n <= 0x00ffffff) return true
    if (n >= 0x0a000000 && n <= 0x0affffff) return true
    if (n >= 0x7f000000 && n <= 0x7fffffff) return true
    if (n >= 0xa9fe0000 && n <= 0xa9feffff) return true
    if (n >= 0xac100000 && n <= 0xac1fffff) return true
    if (n >= 0xc0a80000 && n <= 0xc0a8ffff) return true
    if (n >= 0x64400000 && n <= 0x647fffff) return true
    if (n >= 0xc0000000 && n <= 0xc00000ff) return true
    if (n >= 0xc0000200 && n <= 0xc00002ff) return true
    if (n >= 0xc6120000 && n <= 0xc613ffff) return true
    if (n >= 0xc6336400 && n <= 0xc63364ff) return true
    if (n >= 0xcb007100 && n <= 0xcb0071ff) return true
    if (n >= 0xe0000000) return true
    return false
  }

  if (net.isIPv6(ip)) {
    const normalized = ip.toLowerCase()
    if (normalized === "::" || normalized === "::1") return true
    if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true // ULA
    if (
      normalized.startsWith("fe8") ||
      normalized.startsWith("fe9") ||
      normalized.startsWith("fea") ||
      normalized.startsWith("feb")
    ) {
      return true // link-local
    }
    // IPv4-mapped
    if (normalized.startsWith("::ffff:")) {
      const v4 = normalized.slice("::ffff:".length)
      if (net.isIPv4(v4)) return isPrivateOrReservedIp(v4)
    }
    return false
  }

  return true
}

function normalizeHost(raw: string): string {
  let host = raw.trim().toLowerCase()
  if (host.startsWith("[") && host.endsWith("]")) {
    host = host.slice(1, -1)
  }
  // Strip trailing dot (FQDN)
  if (host.endsWith(".")) host = host.slice(0, -1)
  return host
}

/**
 * Reject private / loopback / link-local / metadata SMTP targets.
 * Resolves DNS so hostname→private IP is also blocked.
 */
export async function assertSmtpHostAllowed(rawHost: string): Promise<string> {
  const host = normalizeHost(rawHost)
  if (!host) {
    throw new Error("SMTP host is required.")
  }
  if (host.length > 253) {
    throw new Error("SMTP host is too long.")
  }
  if (/[\s/\\]/.test(host)) {
    throw new Error("SMTP host contains invalid characters.")
  }
  if (BLOCKED_HOST_EXACT.has(host)) {
    throw new Error("SMTP host is not allowed.")
  }
  if (
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host.endsWith(".lan")
  ) {
    throw new Error("SMTP host is not allowed.")
  }

  if (net.isIP(host)) {
    if (isPrivateOrReservedIp(host)) {
      throw new Error("SMTP host must be a public address.")
    }
    return host
  }

  // Public SMTP hosts are FQDNs (at least one dot).
  if (!host.includes(".")) {
    throw new Error("SMTP host must be a fully qualified domain name.")
  }
  if (
    !/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i.test(
      host,
    )
  ) {
    throw new Error("SMTP host format is invalid.")
  }

  let addresses: { address: string; family: number }[]
  try {
    addresses = await dns.lookup(host, { all: true, verbatim: true })
  } catch {
    throw new Error("SMTP host could not be resolved.")
  }
  if (addresses.length === 0) {
    throw new Error("SMTP host could not be resolved.")
  }
  for (const { address } of addresses) {
    if (isPrivateOrReservedIp(address)) {
      throw new Error(
        "SMTP host resolves to a private or reserved address and is not allowed.",
      )
    }
  }

  return host
}

export function assertSmtpPortAllowed(port: number): number {
  if (!Number.isInteger(port) || !ALLOWED_SMTP_PORTS.has(port)) {
    throw new Error(
      `SMTP port must be one of: ${[...ALLOWED_SMTP_PORTS].sort((a, b) => a - b).join(", ")}.`,
    )
  }
  return port
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Extract bare email from `Name <email@x>` or plain address. */
export function extractEmailAddress(value: string): string | null {
  const raw = value.trim()
  if (!raw) return null
  const angled = raw.match(/<([^<>@\s]+@[^<>@\s]+)>/)
  const candidate = (angled?.[1] ?? raw).trim().toLowerCase()
  if (!EMAIL_RE.test(candidate)) return null
  return candidate
}

export function collectAllowedTestRecipients(input: {
  adminEmail: string
  adminNotificationEmail: string
  supportEmail: string
  smtpUser: string
  smtpFrom: string
}): string[] {
  const allowed = new Set<string>()
  for (const value of [
    input.adminEmail,
    input.adminNotificationEmail,
    input.supportEmail,
    input.smtpUser,
    input.smtpFrom,
  ]) {
    const email = extractEmailAddress(value)
    if (email) allowed.add(email)
  }
  return [...allowed]
}

export function assertAllowedTestRecipient(
  to: string,
  allowed: string[],
): string {
  const email = extractEmailAddress(to)
  if (!email) {
    throw new Error("Enter a valid email address.")
  }
  if (!allowed.includes(email)) {
    throw new Error(
      "Test emails can only be sent to your admin email, support email, or notification inbox.",
    )
  }
  return email
}
