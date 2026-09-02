import { NextResponse } from "next/server"

import {
  checkoutNonceMatches,
  clearCheckoutNonceCookie,
} from "@/lib/checkout-nonce"
import { TRUSTPILOT_INVITE_TOKEN_TTL_SEC } from "@/lib/trustpilot-invite-token"
import { issueTrustpilotInviteToken } from "@/lib/trustpilot-invite"

/** HttpOnly cookie carrying the short-lived Trustpilot invite claim JWT. */
export const TRUSTPILOT_INVITE_COOKIE = "tp_invite"

function inviteCookieBase() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
  }
}

/** Attach invite claim cookie to a response (never put the JWT in JSON/URLs). */
export function setTrustpilotInviteCookie(
  response: NextResponse,
  token: string | null | undefined,
): NextResponse {
  if (!token) return response
  response.cookies.set(TRUSTPILOT_INVITE_COOKIE, token, {
    ...inviteCookieBase(),
    maxAge: TRUSTPILOT_INVITE_TOKEN_TTL_SEC,
  })
  return response
}

export function clearTrustpilotInviteCookie(
  response: NextResponse,
): NextResponse {
  response.cookies.set(TRUSTPILOT_INVITE_COOKIE, "", {
    ...inviteCookieBase(),
    maxAge: 0,
  })
  return response
}

/**
 * Issue invite JWT for a booking and set it as HttpOnly cookie on the JSON
 * response. Token is not included in the response body.
 */
export async function jsonWithTrustpilotInviteCookie(
  bookingId: string | null | undefined,
  body: Record<string, unknown>,
  init?: { status?: number },
): Promise<NextResponse> {
  const response = NextResponse.json(body, { status: init?.status ?? 200 })
  if (!bookingId) return response
  const token = await issueTrustpilotInviteToken(bookingId)
  return setTrustpilotInviteCookie(response, token)
}

/**
 * Mint invite cookie only when the browser presents the checkout nonce that
 * was issued at PayPal/POK order creation (blocks order-id-only attackers).
 */
export async function jsonWithTrustpilotInviteCookieIfCheckoutBound(
  request: Request,
  storedNonce: string | null | undefined,
  bookingId: string | null | undefined,
  body: Record<string, unknown>,
  init?: { status?: number },
): Promise<NextResponse> {
  const response = NextResponse.json(body, { status: init?.status ?? 200 })
  if (!bookingId || !checkoutNonceMatches(request, storedNonce)) {
    return response
  }
  const token = await issueTrustpilotInviteToken(bookingId)
  setTrustpilotInviteCookie(response, token)
  clearCheckoutNonceCookie(response)
  return response
}
