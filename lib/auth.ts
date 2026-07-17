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

/** Operators can manage resources but cannot permanently delete them. */
export function canDelete(user: Pick<AdminUser, "role"> | null | undefined) {
  return user?.role === "admin"
}

/**
 * Returns a 401/403 response when the current session cannot delete,
 * or null when delete is allowed.
 */
export async function requireCanDelete(): Promise<NextResponse | null> {
  const user = await getSession()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!canDelete(user)) {
    return NextResponse.json(
      {
        error:
          "Your account cannot delete bookings, drivers, or pricing. Ask an admin.",
      },
      { status: 403 },
    )
  }
  return null
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE)
}
