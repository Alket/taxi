import { NextResponse } from "next/server"
import { z } from "zod"

import { getSession, hashPassword } from "@/lib/auth"
import { serializeAdminUser } from "@/lib/admin-users"
import { prisma } from "@/lib/db"

const bodySchema = z.object({
  password: z.string().trim().min(8).max(128),
  name: z.string().trim().min(1).max(120).optional(),
})

/** First-login / forced password change for invited admins. */
export async function POST(request: Request) {
  const user = await getSession()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!user.requiresPasswordReset) {
    return NextResponse.json(
      { error: "Password reset is not required for this account." },
      { status: 400 },
    )
  }

  const body = await request.json().catch(() => null)
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters." },
      { status: 400 },
    )
  }

  const passwordHash = await hashPassword(parsed.data.password)
  const name =
    parsed.data.name?.trim() ||
    user.name.replace(/\s*\(invited\)\s*$/i, "").trim() ||
    user.name

  const updated = await prisma.adminUser.update({
    where: { id: user.id },
    data: {
      passwordHash,
      requiresPasswordReset: false,
      name,
    },
  })

  return NextResponse.json({ user: serializeAdminUser(updated) })
}
