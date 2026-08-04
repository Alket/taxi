import { NextResponse } from "next/server"

import {
  isAdmin,
  requireStaffSession,
} from "@/lib/auth"
import { isMailConfigured, sendMail } from "@/lib/mail"
import { takeRateLimit } from "@/lib/rate-limit"
import { getSettings, resolveAdminNotificationEmail } from "@/lib/settings"
import {
  assertAllowedTestRecipient,
  collectAllowedTestRecipients,
} from "@/lib/smtp-security"

const TEST_SMTP_LIMIT = 3
const TEST_SMTP_WINDOW_MS = 10 * 60 * 1000

export async function POST(request: Request) {
  const session = await requireStaffSession(request)
  if ("error" in session) return session.error
  if (!isAdmin(session.user)) {
    return NextResponse.json(
      { error: "Your account cannot access settings. Ask an admin." },
      { status: 403 },
    )
  }

  const limited = takeRateLimit(
    `smtp-test:${session.user.id}`,
    TEST_SMTP_LIMIT,
    TEST_SMTP_WINDOW_MS,
  )
  if (!limited.ok) {
    return NextResponse.json(
      {
        error: `Too many test emails. Try again in ${limited.retryAfterSec}s.`,
      },
      {
        status: 429,
        headers: { "Retry-After": String(limited.retryAfterSec) },
      },
    )
  }

  try {
    if (!(await isMailConfigured())) {
      return NextResponse.json(
        {
          error:
            "SMTP is not configured. Save host, username, and password first (or set SMTP_* env vars).",
        },
        { status: 409 },
      )
    }

    const body = await request.json().catch(() => ({}))
    const settings = await getSettings()
    const allowed = collectAllowedTestRecipients({
      adminEmail: session.user.email,
      adminNotificationEmail: settings.adminNotificationEmail,
      supportEmail: settings.supportEmail,
      smtpUser: settings.smtpUser,
      smtpFrom: settings.smtpFrom,
    })

    const fallback =
      resolveAdminNotificationEmail(settings) ||
      settings.supportEmail.trim() ||
      session.user.email

    const requested =
      typeof body.to === "string" && body.to.trim()
        ? body.to.trim()
        : fallback

    let to: string
    try {
      to = assertAllowedTestRecipient(requested, allowed)
    } catch (err) {
      return NextResponse.json(
        { error: (err as Error).message },
        { status: 400 },
      )
    }

    await sendMail({
      to,
      subject: "SMTP test — Albania Transfers",
      text: "This is a test email from your admin SMTP settings. Configuration looks good.",
      html: `<p>This is a test email from your admin SMTP settings.</p><p>Configuration looks good.</p>`,
    })

    return NextResponse.json({ ok: true, sentTo: to })
  } catch {
    return NextResponse.json(
      {
        error:
          "Failed to send test email. Check host, port, credentials, and TLS settings.",
      },
      { status: 500 },
    )
  }
}
