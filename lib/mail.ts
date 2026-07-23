import nodemailer from "nodemailer"
import type { Transporter } from "nodemailer"

export type SendMailInput = {
  to: string
  subject: string
  text: string
  html?: string
  replyTo?: string
}

function envFlag(value: string | undefined, fallback: boolean): boolean {
  if (value == null || value === "") return fallback
  return !["0", "false", "no", "off"].includes(value.trim().toLowerCase())
}

export function isMailConfigured(): boolean {
  return Boolean(
    process.env.SMTP_HOST?.trim() &&
      process.env.SMTP_USER?.trim() &&
      process.env.SMTP_PASS?.trim(),
  )
}

export function getAppBaseUrl(): string {
  const raw = (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    "http://localhost:3000"
  ).trim()
  try {
    return new URL(raw).origin
  } catch {
    return "http://localhost:3000"
  }
}

export function getMailFrom(): string {
  return (
    process.env.SMTP_FROM?.trim() ||
    process.env.SMTP_USER?.trim() ||
    "noreply@localhost"
  )
}

let transporter: Transporter | null = null

function getTransporter(): Transporter {
  if (transporter) return transporter

  const host = process.env.SMTP_HOST?.trim()
  const user = process.env.SMTP_USER?.trim()
  const pass = process.env.SMTP_PASS?.trim()
  if (!host || !user || !pass) {
    throw new Error("SMTP is not configured.")
  }

  const port = Number(process.env.SMTP_PORT || "465")
  const secure = envFlag(process.env.SMTP_SECURE, port === 465)

  transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    tls: {
      // Shared hosts often serve a wildcard cert that doesn't match the mail hostname.
      rejectUnauthorized: envFlag(
        process.env.SMTP_TLS_REJECT_UNAUTHORIZED,
        true,
      ),
    },
  })

  return transporter
}

export async function sendMail(input: SendMailInput): Promise<{ messageId: string }> {
  if (!isMailConfigured()) {
    throw new Error("SMTP is not configured.")
  }

  const info = await getTransporter().sendMail({
    from: getMailFrom(),
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
    replyTo: input.replyTo,
  })

  return { messageId: String(info.messageId ?? "") }
}
