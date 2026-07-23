import { getAppBaseUrl, sendMail } from "@/lib/mail"
import {
  detailRow,
  escapeHtml,
  wrapEmail,
} from "@/lib/emails/templates"

export async function sendPasswordResetEmail(input: {
  to: string
  name: string
  temporaryPassword: string
  companyName?: string
}): Promise<void> {
  const company = input.companyName?.trim() || "Transfer Ops"
  const loginUrl = `${getAppBaseUrl()}/admin/login`
  const displayName = input.name.replace(/\s*\(invited\)\s*$/i, "").trim() || input.to

  const subject = `Password reset — ${company}`
  const text = [
    `Hi ${displayName},`,
    "",
    `An admin reset your password for the ${company} admin console.`,
    "",
    `Sign in: ${loginUrl}`,
    `Email: ${input.to}`,
    `Temporary password: ${input.temporaryPassword}`,
    "",
    "Sign in and set a new password right away.",
  ].join("\n")

  const html = wrapEmail({
    company,
    eyebrow: "Password reset",
    tone: "warning",
    preheader: `Temporary password for ${company}`,
    title: "Your password was reset",
    introHtml: `Hi ${escapeHtml(displayName)}, an admin reset your password for the <strong>${escapeHtml(company)}</strong> console. Use the temporary password below, then choose a new one.`,
    rowsHtml:
      detailRow("Sign-in email", input.to) +
      detailRow("Temporary password", input.temporaryPassword),
    cta: { href: loginUrl, label: "Sign in" },
    footer: "If you did not expect this, contact your admin immediately.",
  })

  await sendMail({ to: input.to, subject, text, html })
}
