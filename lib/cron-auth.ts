/**
 * Cron job auth — Bearer token only.
 * Do not accept `?secret=` (leaks via access logs, Referer, browser history).
 */
export function authorizeCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret) return false

  const header = request.headers.get("authorization")
  return header === `Bearer ${secret}`
}
