import { SignJWT, jwtVerify } from "jose"

import { getJwtSecretKey } from "@/lib/jwt-secret"

export const DRIVER_SESSION_COOKIE = "driver_session"
export const DRIVER_SESSION_MAX_AGE = 60 * 60 * 24 * 30

export const DRIVER_JWT_ISSUER = "taxi-driver"
export const DRIVER_JWT_AUDIENCE = "driver"

export type DriverSessionClaims = {
  driverId: string
  pinVersion: string | null
}

export async function signDriverSessionToken(
  driverId: string,
  pinVersion?: string,
): Promise<string> {
  const payload: Record<string, string> = { sub: driverId, role: "driver" }
  if (pinVersion) payload.pv = pinVersion
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(DRIVER_JWT_ISSUER)
    .setAudience(DRIVER_JWT_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(getJwtSecretKey())
}

export async function verifyDriverSessionClaims(
  token: string,
): Promise<DriverSessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecretKey(), {
      issuer: DRIVER_JWT_ISSUER,
      audience: DRIVER_JWT_AUDIENCE,
    })
    if (payload.role !== "driver") return null
    if (typeof payload.sub !== "string" || !payload.sub) return null
    return {
      driverId: payload.sub,
      pinVersion: typeof payload.pv === "string" ? payload.pv : null,
    }
  } catch {
    return null
  }
}

export async function verifyDriverSessionToken(
  token: string,
): Promise<string | null> {
  const claims = await verifyDriverSessionClaims(token)
  return claims?.driverId ?? null
}

export async function isValidDriverSessionToken(token: string): Promise<boolean> {
  return (await verifyDriverSessionToken(token)) !== null
}
