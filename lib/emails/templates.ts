import { formatDateTime, formatMoney, PAYMENT_STATUS_LABELS, VEHICLE_LABELS } from "@/lib/format"
import { getAppBaseUrl } from "@/lib/mail"
import type { PaymentStatus, Settings, VehicleType } from "@/lib/types"

/** Brand tokens mirrored for email (inline hex — CSS variables don't work in clients). */
export const EMAIL_BRAND = {
  ink: "#2d3b4e",
  muted: "#6b7585",
  border: "#e2e6eb",
  page: "#f0f2f5",
  surface: "#ffffff",
  accent: "#1D9E75",
  accentSoft: "#e8f7f1",
  danger: "#c2410c",
  dangerSoft: "#fff1eb",
  warning: "#b45309",
  warningSoft: "#fff8eb",
  success: "#1D9E75",
  successSoft: "#e8f7f1",
} as const

export type EmailTone = "default" | "success" | "warning" | "danger"

const TONE: Record<
  EmailTone,
  { bar: string; badgeBg: string; badgeFg: string }
> = {
  default: {
    bar: EMAIL_BRAND.accent,
    badgeBg: EMAIL_BRAND.accentSoft,
    badgeFg: EMAIL_BRAND.accent,
  },
  success: {
    bar: EMAIL_BRAND.success,
    badgeBg: EMAIL_BRAND.successSoft,
    badgeFg: EMAIL_BRAND.success,
  },
  warning: {
    bar: EMAIL_BRAND.warning,
    badgeBg: EMAIL_BRAND.warningSoft,
    badgeFg: EMAIL_BRAND.warning,
  },
  danger: {
    bar: EMAIL_BRAND.danger,
    badgeBg: EMAIL_BRAND.dangerSoft,
    badgeFg: EMAIL_BRAND.danger,
  },
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
}

/** Modern key/value row for email detail cards. */
export function detailRow(label: string, value: string): string {
  return `
    <tr>
      <td style="padding:12px 0;border-bottom:1px solid ${EMAIL_BRAND.border};vertical-align:top;width:38%;">
        <span style="font-size:12px;line-height:1.4;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:${EMAIL_BRAND.muted};">
          ${escapeHtml(label)}
        </span>
      </td>
      <td style="padding:12px 0 12px 16px;border-bottom:1px solid ${EMAIL_BRAND.border};vertical-align:top;">
        <span style="font-size:15px;line-height:1.45;font-weight:600;color:${EMAIL_BRAND.ink};">
          ${escapeHtml(value)}
        </span>
      </td>
    </tr>`
}

export function supportLine(settings: Settings): string {
  return (
    [settings.supportPhone, settings.supportEmail].filter(Boolean).join(" · ") ||
    "Reply to this email if you need help."
  )
}

export function manageBookingUrl(): string {
  return `${getAppBaseUrl()}/my-booking`
}

export function reviewBookingUrl(referenceCode: string, email: string): string {
  const params = new URLSearchParams({
    reference: referenceCode,
    email,
  })
  return `${getAppBaseUrl()}/review?${params.toString()}`
}

export function adminBookingUrl(bookingId: string): string {
  return `${getAppBaseUrl()}/admin/bookings?bookingId=${bookingId}`
}

export function companyName(settings: Settings): string {
  return settings.companyName?.trim() || "Albania Transfers"
}

export function vehicleLabel(type: string): string {
  return VEHICLE_LABELS[type as VehicleType] ?? type
}

export function paymentStatusLabel(status: string): string {
  return (
    PAYMENT_STATUS_LABELS[status as PaymentStatus] ??
    status.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())
  )
}

export function formatWhen(date: Date | string): string {
  const iso = typeof date === "string" ? date : date.toISOString()
  return formatDateTime(iso)
}

export function money(amount: number, currency: string): string {
  return formatMoney(amount, currency)
}

function ctaButton(href: string, label: string): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0;">
      <tr>
        <td align="center" bgcolor="${EMAIL_BRAND.accent}" style="border-radius:999px;background-color:${EMAIL_BRAND.accent};">
          <a href="${escapeHtml(href)}"
             style="display:inline-block;padding:14px 28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;font-weight:700;line-height:1;color:#ffffff;text-decoration:none;border-radius:999px;">
            ${escapeHtml(label)}
          </a>
        </td>
      </tr>
    </table>`
}

/**
 * Full HTML email shell — table layout, inline styles, brand header/footer.
 * Compatible with Gmail, Apple Mail, Outlook (web), and mobile clients.
 */
export function wrapEmail(opts: {
  title: string
  introHtml: string
  rowsHtml: string
  cta?: { href: string; label: string }
  footer: string
  /** Brand / company shown in header */
  company?: string
  /** Hidden inbox preview text */
  preheader?: string
  /** Small status pill above the title */
  eyebrow?: string
  tone?: EmailTone
}): string {
  const tone = TONE[opts.tone ?? "default"]
  const company = opts.company?.trim() || "Albania Transfers"
  const preheader = opts.preheader?.trim() || opts.title
  const year = new Date().getFullYear()

  const badge = opts.eyebrow
    ? `<span style="display:inline-block;margin:0 0 14px;padding:6px 12px;border-radius:999px;background-color:${tone.badgeBg};color:${tone.badgeFg};font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;">${escapeHtml(opts.eyebrow)}</span>`
    : ""

  const details =
    opts.rowsHtml.trim().length > 0
      ? `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px;border-collapse:collapse;">
        ${opts.rowsHtml}
      </table>`
      : ""

  const cta = opts.cta
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 8px;">
        <tr><td align="left">${ctaButton(opts.cta.href, opts.cta.label)}</td></tr>
      </table>`
    : ""

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <title>${escapeHtml(opts.title)}</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td { font-family: Arial, Helvetica, sans-serif !important; }
  </style>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background-color:${EMAIL_BRAND.page};-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">
    ${escapeHtml(preheader)}
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${EMAIL_BRAND.page};margin:0;padding:0;width:100%;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;border-collapse:collapse;">
          <!-- Header -->
          <tr>
            <td style="padding:0 8px 20px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="left" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:18px;font-weight:800;letter-spacing:-0.02em;color:${EMAIL_BRAND.ink};">
                    ${escapeHtml(company)}
                  </td>
                  <td align="right" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;font-weight:600;color:${EMAIL_BRAND.muted};">
                    Transfer booking
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Card -->
          <tr>
            <td style="background-color:${EMAIL_BRAND.surface};border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(45,59,78,0.06);">
              <!-- Accent bar -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td height="4" style="height:4px;line-height:4px;font-size:0;background-color:${tone.bar};">&nbsp;</td>
                </tr>
              </table>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding:32px 28px 36px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${EMAIL_BRAND.ink};">
                    ${badge}
                    <h1 style="margin:0 0 12px;font-size:24px;line-height:1.25;font-weight:800;letter-spacing:-0.03em;color:${EMAIL_BRAND.ink};">
                      ${escapeHtml(opts.title)}
                    </h1>
                    <div style="margin:0 0 28px;font-size:15px;line-height:1.6;color:${EMAIL_BRAND.muted};">
                      ${opts.introHtml}
                    </div>
                    ${details}
                    ${cta}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:24px 8px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
              <p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:${EMAIL_BRAND.muted};text-align:center;">
                ${escapeHtml(opts.footer)}
              </p>
              <p style="margin:0;font-size:12px;line-height:1.5;color:#9aa3b0;text-align:center;">
                &copy; ${year} ${escapeHtml(company)}. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}
