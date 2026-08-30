import { SignJWT, jwtVerify } from "jose"

import { getJwtSecretKey } from "@/lib/jwt-secret"
import { getAppBaseUrl } from "@/lib/mail"
import { ABANDONED_RESUME_TTL_MS } from "@/lib/payment-session"

const ISSUER = "taxi-checkout-resume"
const AUDIENCE = "checkout-resume"

export async function signCheckoutResumeToken(bookingId: string): Promise<string> {
  return new SignJWT({ sub: bookingId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${Math.ceil(ABANDONED_RESUME_TTL_MS / 1000)}s`)
    .sign(getJwtSecretKey())
}

export async function verifyCheckoutResumeToken(
  token: string,
): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecretKey(), {
      issuer: ISSUER,
      audience: AUDIENCE,
    })
    return typeof payload.sub === "string" ? payload.sub : null
  } catch {
    return null
  }
}

export function checkoutContinueUrl(
  referenceCode: string,
  token: string,
): string {
  const base = getAppBaseUrl().replace(/\/$/, "")
  return `${base}/book/continue/${encodeURIComponent(referenceCode)}?token=${encodeURIComponent(token)}`
}
