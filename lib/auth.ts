import { cookies } from "next/headers"
import bcrypt from "bcryptjs"
import { NextResponse } from "next/server"
import type { AdminUser } from "@prisma/client"

import { prisma } from "@/lib/db"
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  signSessionToken,
  verifySessionToken,
} from "@/lib/session"

export { SESSION_COOKIE } from "@/lib/session"

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export async function createSession(adminUserId: string): Promise<void> {
  const token = await signSessionToken(adminUserId)

  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  })
}

export async function getSession(): Promise<AdminUser | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (!token) {
    return null
  }

  const adminUserId = await verifySessionToken(token)
  if (!adminUserId) {
    return null
  }

  try {
    const user = await prisma.adminUser.findUnique({
      where: { id: adminUserId },
    })
    // Treat suspended accounts as logged out so they lose console access.
    if (user?.suspended) {
      return null
    }
    return user
  } catch (error) {
    // Surface DB/client mismatches instead of masking them as Unauthorized.
    console.error("[auth] Failed to load admin session:", error)
    throw error
  }
}

/** Full admin role (not operator). */
export function isAdmin(user: Pick<AdminUser, "role"> | null | undefined) {
  return user?.role === "admin"
}

/** Operators can manage day-to-day ops but cannot permanently delete. */
export function canDelete(user: Pick<AdminUser, "role"> | null | undefined) {
  return isAdmin(user)
}

/**
 * Staff session for any authenticated admin console user (admin or operator).
 * Verifies JWT, loads AdminUser, rejects suspended accounts, and blocks
 * requiresPasswordReset except on allowlisted endpoints.
 */
export async function requireStaffSession(
  request?: Request,
): Promise<{ user: AdminUser } | { error: NextResponse }> {
  const user = await getSession()
  if (!user) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    }
  }

  if (user.requiresPasswordReset) {
    const rawPath = request ? new URL(request.url).pathname : ""
    const path =
      rawPath.length > 1 && rawPath.endsWith("/")
        ? rawPath.slice(0, -1)
        : rawPath
    const allowedWhileResetPending = new Set([
      "/api/admin/set-password",
      "/api/admin/logout",
      "/api/admin/me",
    ])
    if (!allowedWhileResetPending.has(path)) {
      return {
        error: NextResponse.json(
          { error: "Password reset required." },
          { status: 403 },
        ),
      }
    }
  }

  return { user }
}

/**
 * Returns a 401/403 response when the current session is not an admin,
 * or null when access is allowed.
 */
export async function requireAdmin(
  message = "Only admins can perform this action.",
  request?: Request,
): Promise<NextResponse | null> {
  const session = await requireStaffSession(request)
  if ("error" in session) return session.error
  if (!isAdmin(session.user)) {
    return NextResponse.json({ error: message }, { status: 403 })
  }
  return null
}

/**
 * Returns a 401/403 response when the current session cannot delete,
 * or null when delete is allowed.
 */
export async function requireCanDelete(): Promise<NextResponse | null> {
  return requireAdmin(
    "Your account cannot delete bookings, drivers, pricing, or reviews. Ask an admin.",
  )
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE)
}
