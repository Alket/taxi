import { randomBytes } from "crypto"

import { NextResponse } from "next/server"
import type { AdminRole } from "@prisma/client"

import { serializeAdminUser } from "@/lib/admin-users"
import { hashPassword, requireAdmin } from "@/lib/auth"
import { isAdminRole } from "@/lib/auth-client"
import { prisma } from "@/lib/db"
import { sendTeamInviteEmail } from "@/lib/emails/team-invite"
import { isMailConfigured } from "@/lib/mail"
import { getSettings } from "@/lib/settings"

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
  const denied = await requireAdmin("Only admins can invite team members.")
  if (denied) return denied

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

  let emailSent = false
  let emailError: string | undefined

  if (isMailConfigured()) {
    try {
      let companyName = "Transfer Ops"
      try {
        const settings = await getSettings()
        companyName = settings.companyName || companyName
      } catch {
        // settings optional for invite copy
      }

      await sendTeamInviteEmail({
        to: email,
        role: requestedRole,
        temporaryPassword,
        companyName,
      })
      emailSent = true
    } catch (error) {
      emailError = (error as Error).message || "Failed to send invite email."
      console.error("[mail] team invite failed:", error)
    }
  } else {
    emailError = "SMTP is not configured."
  }

  return NextResponse.json(
    {
      user: serializeAdminUser(user),
      temporaryPassword,
      emailSent,
      emailError: emailSent ? undefined : emailError,
    },
    { status: 201 },
  )
}
