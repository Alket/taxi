import { createHash, randomBytes, timingSafeEqual } from "crypto"
import { NextResponse } from "next/server"

/** HttpOnly cookie binding the browser that started PayPal/POK checkout. */
export const CHECKOUT_NONCE_COOKIE = "checkout_nonce"
export const CHECKOUT_NONCE_TTL_SEC = 60 * 60 * 2

function cookieBase() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
  }
}

export function generateCheckoutNonce(): string {
  return randomBytes(32).toString("base64url")
}

export function setCheckoutNonceCookie(
  response: NextResponse,
  nonce: string,
): NextResponse {
  response.cookies.set(CHECKOUT_NONCE_COOKIE, nonce, {
    ...cookieBase(),
    maxAge: CHECKOUT_NONCE_TTL_SEC,
  })
  return response
}

export function clearCheckoutNonceCookie(response: NextResponse): NextResponse {
  response.cookies.set(CHECKOUT_NONCE_COOKIE, "", {
    ...cookieBase(),
    maxAge: 0,
  })
  return response
}

export function readCheckoutNonceFromRequest(request: Request): string {
  const header = request.headers.get("cookie") || ""
  for (const part of header.split(";")) {
    const [rawName, ...rest] = part.trim().split("=")
    if (rawName === CHECKOUT_NONCE_COOKIE) {
      return decodeURIComponent(rest.join("=").trim())
    }
  }
  return ""
}

/** Constant-time compare of stored intent nonce vs browser cookie. */
export function checkoutNonceMatches(
  request: Request,
  storedNonce: string | null | undefined,
): boolean {
  const stored = storedNonce?.trim() || ""
  const cookie = readCheckoutNonceFromRequest(request)
  if (!stored || !cookie) return false
  const a = createHash("sha256").update(stored).digest()
  const b = createHash("sha256").update(cookie).digest()
  return timingSafeEqual(a, b)
}
