import { NextResponse } from "next/server"
import { z } from "zod"

import { createSession, verifyPassword } from "@/lib/auth"
import { clientIpFromRequest } from "@/lib/client-ip"
import { prisma } from "@/lib/db"
import { takeRateLimit } from "@/lib/rate-limit"

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

const INVALID_CREDENTIALS = "Invalid email or password."

/** Caps credential stuffing / password spray from one client. */
const LOGIN_IP_LIMIT = 30
const LOGIN_IP_WINDOW_MS = 15 * 60 * 1000
/** Caps spray against a single staff email. */
const LOGIN_EMAIL_LIMIT = 10
const LOGIN_EMAIL_WINDOW_MS = 15 * 60 * 1000

function tooMany(retryAfterSec: number) {
  return NextResponse.json(
    { error: `Too many login attempts. Try again in ${retryAfterSec}s.` },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfterSec) },
    },
  )
}

export async function POST(request: Request) {
  const ip = clientIpFromRequest(request)
  const ipLimited = takeRateLimit(
    `admin-login-ip:${ip}`,
    LOGIN_IP_LIMIT,
    LOGIN_IP_WINDOW_MS,
  )
  if (!ipLimited.ok) return tooMany(ipLimited.retryAfterSec)

  const body = await request.json().catch(() => null)
  const parsed = loginSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: INVALID_CREDENTIALS }, { status: 400 })
  }

  const email = parsed.data.email.trim().toLowerCase()
  const emailLimited = takeRateLimit(
    `admin-login-email:${email}`,
    LOGIN_EMAIL_LIMIT,
    LOGIN_EMAIL_WINDOW_MS,
  )
  if (!emailLimited.ok) return tooMany(emailLimited.retryAfterSec)

  const { password } = parsed.data
  const user = await prisma.adminUser.findUnique({
    where: { email },
  })

  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return NextResponse.json({ error: INVALID_CREDENTIALS }, { status: 401 })
  }

  if (user.suspended) {
    return NextResponse.json(
      { error: "This account has been suspended. Contact an admin." },
      { status: 403 },
    )
  }

  await prisma.adminUser.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  })

  await createSession(user.id)

  return NextResponse.json({
    success: true,
    requiresPasswordReset: user.requiresPasswordReset,
  })
}
