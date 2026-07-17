import { randomBytes } from "crypto"

import { NextResponse } from "next/server"
import type { AdminRole } from "@prisma/client"

import { serializeAdminUser } from "@/lib/admin-users"
import { canDelete, getSession, hashPassword } from "@/lib/auth"
import { isAdminRole } from "@/lib/auth-client"
import { prisma } from "@/lib/db"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function generateTemporaryPassword() {
  const raw = randomBytes(9).toString("base64url")
  return raw.slice(0, 12)
}

function deriveInviteName(email: string) {
  const local = email.split("@")[0].replace(/[._-]+/g, " ")
  const title =
    local.replace(/\b\w/g, (char) => char.toUpperCase()) || "Invited admin"
  return `${title} (invited)`
}

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : ""
  const requestedRole: AdminRole = isAdminRole(body.role)
    ? body.role
    : "operator"

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json(
      { error: "Please enter a valid email address." },
      { status: 400 },
    )
  }

  if (requestedRole === "admin" && !canDelete(session)) {
    return NextResponse.json(
      { error: "Only admins can invite other admins." },
      { status: 403 },
    )
  }

  const existing = await prisma.adminUser.findUnique({
    where: { email },
    select: { id: true },
  })
  if (existing) {
    return NextResponse.json(
      { error: "That email is already on the team." },
      { status: 409 },
    )
  }

  const temporaryPassword = generateTemporaryPassword()
  const passwordHash = await hashPassword(temporaryPassword)

  const user = await prisma.adminUser.create({
    data: {
      name: deriveInviteName(email),
      email,
      passwordHash,
      role: requestedRole,
      requiresPasswordReset: true,
    },
  })

  // TODO: Send invite email with a password-set link instead of returning the
  // temporary password in the API response.

  return NextResponse.json(
    {
      user: serializeAdminUser(user),
      temporaryPassword,
    },
    { status: 201 },
  )
}
