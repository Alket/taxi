import { ADMIN_ROLE_LABELS } from "@/lib/auth-client"
import { getAppBaseUrl, sendMail } from "@/lib/mail"
import type { AdminRole } from "@/lib/types"
import {
  detailRow,
  escapeHtml,
  wrapEmail,
} from "@/lib/emails/templates"

export async function sendTeamInviteEmail(input: {
  to: string
  role: AdminRole
  temporaryPassword: string
  companyName?: string
}): Promise<void> {
  const company = input.companyName?.trim() || "Transfer Ops"
  const loginUrl = `${getAppBaseUrl()}/admin/login`
  const roleLabel = ADMIN_ROLE_LABELS[input.role]

  const subject = `You're invited to ${company}`
  const text = [
    `You've been invited to the ${company} admin console as ${roleLabel}.`,
    "",
    `Sign in: ${loginUrl}`,
    `Email: ${input.to}`,
    `Temporary password: ${input.temporaryPassword}`,
    "",
    "Please sign in and change your password after your first login.",
  ].join("\n")

  const html = wrapEmail({
    company,
    eyebrow: "Team invite",
    tone: "default",
    preheader: `Join ${company} as ${roleLabel}`,
    title: "You're invited",
    introHtml: `You've been invited to the <strong>${escapeHtml(company)}</strong> admin console as <strong>${escapeHtml(roleLabel)}</strong>. Use the temporary password below for your first sign-in, then set a new one.`,
    rowsHtml:
      detailRow("Sign-in email", input.to) +
      detailRow("Temporary password", input.temporaryPassword) +
      detailRow("Role", roleLabel),
    cta: { href: loginUrl, label: "Sign in to admin" },
    footer: "If you were not expecting this invite, you can ignore this email.",
  })

  await sendMail({ to: input.to, subject, text, html })
}
