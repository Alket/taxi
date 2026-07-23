import { NextResponse } from "next/server"
import { z } from "zod"

import { createSession, verifyPassword } from "@/lib/auth"
import { prisma } from "@/lib/db"

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

const INVALID_CREDENTIALS = "Invalid email or password."

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const parsed = loginSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: INVALID_CREDENTIALS }, { status: 400 })
  }

  const { email, password } = parsed.data
  const user = await prisma.adminUser.findUnique({
    where: { email: email.toLowerCase() },
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
