import { SignJWT, jwtVerify } from "jose"

export const DRIVER_SESSION_COOKIE = "driver_session"
export const DRIVER_SESSION_MAX_AGE = 60 * 60 * 24 * 30

function getJwtSecret() {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    throw new Error("JWT_SECRET is not set")
  }
  return new TextEncoder().encode(secret)
}

export async function signDriverSessionToken(driverId: string): Promise<string> {
  return new SignJWT({ sub: driverId, role: "driver" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(getJwtSecret())
}

export async function verifyDriverSessionToken(
  token: string,
): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret())
    if (payload.role !== "driver") return null
    return typeof payload.sub === "string" ? payload.sub : null
  } catch {
    return null
  }
}

export async function isValidDriverSessionToken(token: string): Promise<boolean> {
  return (await verifyDriverSessionToken(token)) !== null
}
