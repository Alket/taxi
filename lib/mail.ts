import nodemailer from "nodemailer"
import type { Transporter } from "nodemailer"

import { prisma } from "@/lib/db"
import { decryptSecret, encryptSecret, isEncryptedSecret } from "@/lib/secret-box"

export type SendMailInput = {
  to: string
  subject: string
  text: string
  html?: string
  replyTo?: string
}

type SmtpConfig = {
  host: string
  port: number
  secure: boolean
  user: string
  pass: string
  from: string
  tlsRejectUnauthorized: boolean
}

function envFlag(value: string | undefined, fallback: boolean): boolean {
  if (value == null || value === "") return fallback
  return !["0", "false", "no", "off"].includes(value.trim().toLowerCase())
}

function configFromEnv(): SmtpConfig | null {
  const host = process.env.SMTP_HOST?.trim()
  const user = process.env.SMTP_USER?.trim()
  const pass = process.env.SMTP_PASS?.trim()
  if (!host || !user || !pass) return null

  const port = Number(process.env.SMTP_PORT || "465")
  return {
    host,
    port: Number.isFinite(port) && port > 0 ? port : 465,
    secure: envFlag(process.env.SMTP_SECURE, port === 465),
    user,
    pass,
    from:
      process.env.SMTP_FROM?.trim() ||
      user ||
      "noreply@localhost",
    tlsRejectUnauthorized: envFlag(
      process.env.SMTP_TLS_REJECT_UNAUTHORIZED,
      true,
    ),
  }
}

async function configFromDb(): Promise<SmtpConfig | null> {
  try {
    const row = await prisma.settings.findUnique({
      where: { id: "default" },
      select: {
        smtpHost: true,
        smtpPort: true,
        smtpSecure: true,
        smtpUser: true,
        smtpPass: true,
        smtpFrom: true,
        smtpTlsRejectUnauthorized: true,
      },
    })
    if (!row) return null

    const host = row.smtpHost?.trim()
    const user = row.smtpUser?.trim()
    const storedPass = row.smtpPass?.trim()
    if (!host || !user || !storedPass) return null

    let pass: string
    try {
      pass = decryptSecret(storedPass)
    } catch {
      return null
    }
    if (!pass) return null

    // Lazy-migrate legacy plaintext passwords to encrypted storage.
    if (!isEncryptedSecret(storedPass)) {
      void prisma.settings
        .update({
          where: { id: "default" },
          data: { smtpPass: encryptSecret(pass) },
        })
        .catch(() => {
          /* best-effort */
        })
    }

    const port = row.smtpPort > 0 ? row.smtpPort : 465
    return {
      host,
      port,
      secure: row.smtpSecure,
      user,
      pass,
      from: row.smtpFrom?.trim() || user,
      tlsRejectUnauthorized: row.smtpTlsRejectUnauthorized,
    }
  } catch {
    return null
  }
}

/** Prefer Settings SMTP when complete; otherwise SMTP_* env vars. */
export async function resolveSmtpConfig(): Promise<SmtpConfig | null> {
  return (await configFromDb()) ?? configFromEnv()
}

export async function isMailConfigured(): Promise<boolean> {
  return Boolean(await resolveSmtpConfig())
}

/**
 * Public origin used in email links (Manage booking, review, admin deep links).
 * Prefer a stable marketing/site URL over ephemeral tunnels (ngrok) — Gmail
 * treats tunnel links as phishing and may hide the whole message.
 */
export function getAppBaseUrl(): string {
  const candidates = [
    process.env.EMAIL_PUBLIC_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.APP_URL,
  ]

  const parsed: string[] = []
  for (const raw of candidates) {
    const value = raw?.trim()
    if (!value) continue
    try {
      parsed.push(new URL(value).origin)
    } catch {
      /* try next */
    }
  }

  const stable = parsed.find((origin) => !isEphemeralTunnelHost(origin))
  if (stable) return stable
  if (parsed[0]) return parsed[0]
  return "http://localhost:3000"
}

function isEphemeralTunnelHost(origin: string): boolean {
  try {
    const host = new URL(origin).hostname.toLowerCase()
    return (
      host.endsWith(".ngrok-free.dev") ||
      host.endsWith(".ngrok-free.app") ||
      host.endsWith(".ngrok.io") ||
      host.endsWith(".loca.lt") ||
      host.endsWith(".trycloudflare.com")
    )
  } catch {
    return false
  }
}

export async function getMailFrom(): Promise<string> {
  const config = await resolveSmtpConfig()
  return config?.from || "noreply@localhost"
}

/** Build `Name <email@domain>` when From is a bare address. */
function formatFromHeader(from: string, displayName?: string): string {
  const cleaned = sanitizeMailHeader(from, "from")
  if (/<[^>]+@[^>]+>/.test(cleaned)) return cleaned
  const name = displayName?.replace(/[\r\n"<>]/g, "").trim()
  if (!name) return cleaned
  return `"${name}" <${cleaned}>`
}

let transporter: Transporter | null = null
let transporterKey: string | null = null

async function getTransporter(config: SmtpConfig): Promise<Transporter> {
  const key = [
    config.host,
    config.port,
    config.secure,
    config.user,
    config.pass,
    config.tlsRejectUnauthorized,
  ].join("|")

  if (transporter && transporterKey === key) return transporter

  transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.pass },
    pool: true,
    maxConnections: 1,
    maxMessages: 50,
    tls: {
      // Shared hosts often serve a wildcard cert that doesn't match the mail hostname.
      rejectUnauthorized: config.tlsRejectUnauthorized,
    },
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 30_000,
  })
  transporterKey = key
  return transporter
}

export async function sendMail(
  input: SendMailInput,
): Promise<{ messageId: string; accepted: string[]; response: string }> {
  const config = await resolveSmtpConfig()
  if (!config) {
    throw new Error("SMTP is not configured.")
  }

  const to = sanitizeMailHeader(input.to, "to")
  const subject = sanitizeMailHeader(input.subject, "subject")
  // Drop invalid Reply-To rather than failing the whole send (some SMTPs reject
  // the message when Reply-To is not a valid address).
  let replyTo: string | undefined
  if (input.replyTo != null && input.replyTo !== "") {
    try {
      const cleaned = sanitizeMailHeader(input.replyTo, "replyTo")
      replyTo = cleaned.includes("@") ? cleaned : undefined
    } catch {
      replyTo = undefined
    }
  }

  let displayName: string | undefined
  try {
    const { getSettings } = await import("@/lib/settings")
    displayName = (await getSettings()).companyName
  } catch {
    displayName = undefined
  }
  const from = formatFromHeader(config.from, displayName)

  const info = await (await getTransporter(config)).sendMail({
    from,
    to,
    subject,
    text: input.text,
    html: input.html,
    replyTo,
  })

  const accepted = (info.accepted ?? []).map(String)
  const rejected = (info.rejected ?? []).map(String)
  const response = String(info.response ?? "")

  if (rejected.length > 0 || accepted.length === 0) {
    throw new Error(
      `SMTP did not accept recipient ${to}` +
        (rejected.length ? ` (rejected: ${rejected.join(", ")})` : "") +
        (response ? ` — ${response}` : ""),
    )
  }

  return {
    messageId: String(info.messageId ?? ""),
    accepted,
    response,
  }
}

/** Remove CR/LF and other ASCII controls so values cannot inject SMTP headers. */
function sanitizeMailHeader(value: string, field: string): string {
  const cleaned = value.replace(/[\r\n\u0000-\u001f\u007f]/g, "").trim()
  if (!cleaned) {
    throw new Error(`Invalid email ${field}: empty after sanitizing.`)
  }
  return cleaned
}
