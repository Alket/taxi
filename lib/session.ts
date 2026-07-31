import { SignJWT, jwtVerify } from "jose"

import { getJwtSecretKey } from "@/lib/jwt-secret"

export const SESSION_COOKIE = "admin_session"
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7

export const ADMIN_JWT_ISSUER = "taxi-admin"
export const ADMIN_JWT_AUDIENCE = "admin"

export async function signSessionToken(adminUserId: string): Promise<string> {
  return new SignJWT({ sub: adminUserId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(ADMIN_JWT_ISSUER)
    .setAudience(ADMIN_JWT_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getJwtSecretKey())
}

export async function verifySessionToken(
  token: string,
): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecretKey(), {
      issuer: ADMIN_JWT_ISSUER,
      audience: ADMIN_JWT_AUDIENCE,
    })
    return typeof payload.sub === "string" ? payload.sub : null
  } catch {
    return null
  }
}

export async function isValidSessionToken(token: string): Promise<boolean> {
  return (await verifySessionToken(token)) !== null
}
