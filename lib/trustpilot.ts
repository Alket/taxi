/** Trustpilot invitation (invitejs) helpers — safe for Node QA / server. */

const INTEGRATION_KEY_RE = /^[A-Za-z0-9_-]{8,128}$/

/** Normalize Trustpilot invitation integration key from env. */
export function normalizeTrustpilotIntegrationKey(
  raw: string | null | undefined,
): string | null {
  const key = raw?.trim() ?? ""
  if (!key || !INTEGRATION_KEY_RE.test(key)) return null
  return key
}

/** True for staff portals where invitejs must not load. */
export function isTrustpilotStaffPath(pathname: string) {
  const path = pathname.split("?")[0] || "/"
  return (
    path === "/admin" ||
    path.startsWith("/admin/") ||
    path === "/driver" ||
    path.startsWith("/driver/")
  )
}
