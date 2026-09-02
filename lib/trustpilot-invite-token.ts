import { SignJWT, jwtVerify } from "jose"

import { getJwtSecretKey } from "@/lib/jwt-secret"

const ISSUER = "taxi-trustpilot-invite"
const AUDIENCE = "trustpilot-invite"
/** Short window after checkout — enough for payment redirects, not long-lived links. */
export const TRUSTPILOT_INVITE_TOKEN_TTL_SEC = 60 * 60 * 2

export type TrustpilotInviteTokenPayload = {
  bookingId: string
  referenceCode: string
}

export async function signTrustpilotInviteToken(
  payload: TrustpilotInviteTokenPayload,
): Promise<string> {
  return new SignJWT({
    bookingId: payload.bookingId,
    referenceCode: payload.referenceCode.toUpperCase(),
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setSubject(payload.bookingId)
    .setIssuedAt()
    .setExpirationTime(`${TRUSTPILOT_INVITE_TOKEN_TTL_SEC}s`)
    .sign(getJwtSecretKey())
}

export async function verifyTrustpilotInviteToken(
  token: string,
): Promise<TrustpilotInviteTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecretKey(), {
      issuer: ISSUER,
      audience: AUDIENCE,
    })
    const bookingId =
      typeof payload.bookingId === "string"
        ? payload.bookingId
        : typeof payload.sub === "string"
          ? payload.sub
          : null
    const referenceCode =
      typeof payload.referenceCode === "string"
        ? payload.referenceCode.trim().toUpperCase()
        : null
    if (!bookingId || !referenceCode) return null
    return { bookingId, referenceCode }
  } catch {
    return null
  }
}
