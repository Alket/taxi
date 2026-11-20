import { cookies } from "next/headers"

import { COOKIE_CONSENT_KEY, parseCookieConsent } from "@/lib/cookie-consent"

/** True when the visitor already accepted or rejected cookies. */
export async function hasCookieConsentDecision(): Promise<boolean> {
  const jar = await cookies()
  const raw = jar.get(COOKIE_CONSENT_KEY)?.value ?? null
  return parseCookieConsent(raw) != null
}
