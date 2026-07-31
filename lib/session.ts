import { SignJWT, jwtVerify } from "jose"

export const SESSION_COOKIE = "admin_session"
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7

export const ADMIN_JWT_ISSUER = "taxi-admin"
export const ADMIN_JWT_AUDIENCE = "admin"

function getJwtSecret() {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    throw new Error("JWT_SECRET is not set")
  }
  return new TextEncoder().encode(secret)
}

export async function signSessionToken(adminUserId: string): Promise<string> {
  return new SignJWT({ sub: adminUserId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(ADMIN_JWT_ISSUER)
    .setAudience(ADMIN_JWT_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getJwtSecret())
}

export async function verifySessionToken(
  token: string,
): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret(), {
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
