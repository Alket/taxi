import { randomBytes } from "crypto"

import { NextResponse } from "next/server"

import { serializeAdminUser } from "@/lib/admin-users"
import { getSession, hashPassword, requireAdmin } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { sendPasswordResetEmail } from "@/lib/emails/password-reset"
import { isMailConfigured } from "@/lib/mail"
import { getSettings } from "@/lib/settings"

type RouteContext = {
  params: Promise<{ id: string }>
}

function generateTemporaryPassword() {
  const raw = randomBytes(9).toString("base64url")
  return raw.slice(0, 12)
}

/**
 * Admin-only: reset an operator's password, force setup on next login,
 * and email them the temporary password when SMTP is configured.
 */
export async function POST(_request: Request, context: RouteContext) {
  const denied = await requireAdmin("Only admins can reset passwords.")
  if (denied) return denied

  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await context.params
  if (id === session.id) {
    return NextResponse.json(
      { error: "You cannot reset your own password here." },
      { status: 400 },
    )
  }

  const target = await prisma.adminUser.findUnique({ where: { id } })
  if (!target) {
    return NextResponse.json(
      { error: "Team member not found." },
      { status: 404 },
    )
  }

  if (target.role !== "operator") {
    return NextResponse.json(
      { error: "Only operator passwords can be reset from the team panel." },
      { status: 403 },
    )
  }

  if (target.suspended) {
    return NextResponse.json(
      { error: "Reactivate this account before resetting the password." },
      { status: 409 },
    )
  }

  const temporaryPassword = generateTemporaryPassword()
  const passwordHash = await hashPassword(temporaryPassword)

  const updated = await prisma.adminUser.update({
    where: { id },
    data: {
      passwordHash,
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
        // optional
      }
      await sendPasswordResetEmail({
        to: updated.email,
        name: updated.name,
        temporaryPassword,
        companyName,
      })
      emailSent = true
    } catch (error) {
      emailError = (error as Error).message || "Failed to send email."
      console.error("[mail] password reset failed:", error)
    }
  } else {
    emailError = "SMTP is not configured."
  }

  return NextResponse.json({
    user: serializeAdminUser(updated),
    temporaryPassword,
    emailSent,
    emailError: emailSent ? undefined : emailError,
  })
}
