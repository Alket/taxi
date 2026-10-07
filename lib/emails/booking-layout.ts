/**
 * Rich booking confirmation HTML (customer + admin) — single / round-trip.
 * Structure matches the approved mockups; values come from the reservation.
 *
 * Gmail mobile: fluid width (100% + max-width:600) so cards fill the viewport
 * when Gmail strips <style> media queries.
 * Dark mode:
 * - meta color-scheme "light only" stops Gmail app forced invert (keeps mockup)
 * - :root color-scheme light dark re-enables Apple Mail / Outlook custom dark
 * - @media (prefers-color-scheme: dark) supplies that intentional dark theme
 */
import {
  BOOKER_RELATION_LABELS,
  type BookerRelation,
} from "@/lib/booker-relation"
import {
  EMAIL_BRAND,
  adminBookingUrl,
  companyName,
  emailLogoUrl,
  escapeHtml,
  formatWhen,
  manageBookingUrl,
  money,
  supportLine,
  vehicleLabel,
} from "@/lib/emails/templates"
import { getAppBaseUrl } from "@/lib/mail"
import type { Settings } from "@/lib/types"

const EMAIL_FONT =
  "'Mulish', 'Museo Sans', Arial, Helvetica, sans-serif"
const MULISH_FONT_URL =
  "https://fonts.googleapis.com/css2?family=Mulish:wght@500;600;700;800&display=swap"

const PAGE_BG = "#eef3f1"
const MUTED = "#6a788a"
const MUTED_SOFT = "#8b98a8"
const CHIP_BG = "#e1ebe6"
const CARD_BG = "#eef6f2"
const CARD_BORDER = "#b9d2c7"
const CARD_SHADOW = "0 4px 14px rgba(29,60,50,0.10)"
const BADGE_BG = "#e4f6ee"
const BADGE_FG = "#14775a"
const AMOUNT_LABEL = "#bfeadb"
const AMOUNT_META = "#d9f3ea"
const ROUTE_LINE = "#8fb8a8"
const DASH = "#a9c7ba"

export type BookingTripLeg = {
  referenceCode: string
  pickupPin: string
  pickupAddress: string
  dropoffAddress: string
  pickupDateTime: Date | string
  flightNumber: string | null
  vehicleType: string
  passengerCount: number
  luggageCount: number
  currency: string
  totalPrice: { toString(): string } | number
  balanceDue: { toString(): string } | number
  bookedForOther: boolean
  passengerName: string | null
  passengerEmail: string | null
  passengerPhone: string | null
  passengerNoEmail: boolean
  bookerRelation: string | null
  customer: {
    name: string
    email: string
    phone: string
  }
}

export type BookingTripEmailAudience = "customer" | "admin"

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase()
}

function contactLine(opts: {
  email?: string | null
  phone?: string | null
  noEmail?: boolean
}): string {
  const bits: string[] = []
  if (opts.noEmail) {
    bits.push("Email not provided")
  } else if (opts.email?.trim()) {
    const email = opts.email.trim()
    bits.push(
      `<a href="mailto:${escapeHtml(email)}" class="dm-link" style="text-decoration:none;color:${EMAIL_BRAND.accent};">${escapeHtml(email)}</a>`,
    )
  }
  if (opts.phone?.trim()) {
    const phone = opts.phone.trim()
    const tel = phone.replace(/[^\d+]/g, "")
    bits.push(
      `<a href="tel:${escapeHtml(tel || phone)}" class="dm-muted" style="color:${MUTED};text-decoration:none;">${escapeHtml(phone)}</a>`,
    )
  }
  return bits.join(" &middot; ")
}

function personRow(opts: {
  name: string
  chip: string
  email?: string | null
  phone?: string | null
  noEmail?: boolean
  accent?: boolean
  marginBottom?: boolean
}): string {
  const bg = opts.accent ? BADGE_BG : EMAIL_BRAND.ink
  const fg = opts.accent ? BADGE_FG : "#ffffff"
  const contacts = contactLine({
    email: opts.email,
    phone: opts.phone,
    noEmail: opts.noEmail,
  })
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"${opts.marginBottom ? ' style="margin-bottom:14px;"' : ""}><tr>
      <td width="44" valign="top"><div class="${opts.accent ? "dm-avatar-soft" : "dm-avatar-ink"}" style="width:40px;height:40px;border-radius:50%;background:${bg};color:${fg};font-weight:700;font-size:14px;line-height:40px;text-align:center;font-family:${EMAIL_FONT};">${escapeHtml(initials(opts.name))}</div></td>
      <td style="font-size:13px;line-height:1.6;color:${MUTED};font-family:${EMAIL_FONT};">
        <span class="dm-ink" style="font-size:15px;font-weight:700;color:${EMAIL_BRAND.ink};">${escapeHtml(opts.name)}</span>
        &nbsp;<span class="dm-chip" style="background:${CHIP_BG};border-radius:999px;padding:2px 8px;font-size:11px;font-weight:600;color:${EMAIL_BRAND.ink};">${escapeHtml(opts.chip)}</span>
        ${contacts ? `<br>${contacts}` : ""}
      </td>
    </tr></table>`
}

function legLabel(index: number, total: number): string {
  if (total === 1) return "Single trip"
  if (index === 0) return "Outbound"
  if (index === 1) return "Return"
  return `Leg ${index + 1}`
}

function legCard(leg: BookingTripLeg, label: string, topPad: string): string {
  const fare = money(Number(leg.totalPrice), leg.currency)
  const flight = leg.flightNumber?.trim() || "—"
  const when = formatWhen(leg.pickupDateTime).replace(/,\s*/g, " · ")
  return `
  <tr><td class="px" style="padding:${topPad} 40px 0;font-family:${EMAIL_FONT};">
    <table role="presentation" class="dm-card" width="100%" cellpadding="0" cellspacing="0" style="background:${CARD_BG};border:2px solid ${CARD_BORDER};border-radius:18px;box-shadow:${CARD_SHADOW};">
      <tr><td style="padding:22px 24px 0;">
        <table role="presentation" width="100%"><tr>
          <td class="dm-accent" style="font-size:12px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:${EMAIL_BRAND.accent};">${escapeHtml(label)}</td>
          <td align="right" class="dm-muted-soft" style="font-size:12px;color:${MUTED_SOFT};font-family:${EMAIL_FONT};">${escapeHtml(leg.referenceCode)}</td>
        </tr></table>
        <div class="dm-ink" style="font-size:20px;font-weight:700;letter-spacing:-0.3px;margin:6px 0 18px;color:${EMAIL_BRAND.ink};">${escapeHtml(when)}</div>
      </td></tr>
      <tr><td style="padding:0 24px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td width="26" valign="top" style="padding-top:5px;"><div style="width:12px;height:12px;border-radius:50%;background:${EMAIL_BRAND.accent};"></div></td>
            <td class="dm-muted-soft" style="font-size:12px;color:${MUTED_SOFT};">Pickup<div class="dm-ink" style="font-size:16px;font-weight:600;color:${EMAIL_BRAND.ink};margin-top:2px;">${escapeHtml(leg.pickupAddress)}</div></td>
          </tr>
          <tr>
            <td width="26" style="padding:4px 0 4px 5px;"><div style="width:2px;height:22px;background:${ROUTE_LINE};"></div></td><td></td>
          </tr>
          <tr>
            <td width="26" valign="top" style="padding-top:5px;"><div class="dm-dot-ink" style="width:8px;height:8px;border-radius:50%;border:2px solid ${EMAIL_BRAND.ink};"></div></td>
            <td class="dm-muted-soft" style="font-size:12px;color:${MUTED_SOFT};">Drop-off<div class="dm-ink" style="font-size:16px;font-weight:600;color:${EMAIL_BRAND.ink};margin-top:2px;">${escapeHtml(leg.dropoffAddress)}</div></td>
          </tr>
        </table>
      </td></tr>
      <tr><td style="padding:20px 24px 22px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="dm-dash" style="border-top:2px dashed ${DASH};table-layout:fixed;width:100%;">
          <tr>
            <td width="33%" valign="top" class="dm-muted-soft" style="width:33%;padding-top:16px;padding-right:6px;font-size:12px;color:${MUTED_SOFT};">Flight<div class="dm-ink" style="font-size:14px;font-weight:700;color:${EMAIL_BRAND.ink};margin-top:2px;word-break:break-word;">${escapeHtml(flight)}</div></td>
            <td width="34%" valign="top" align="center" class="dm-muted-soft" style="width:34%;padding-top:16px;padding-left:4px;padding-right:4px;font-size:12px;color:${MUTED_SOFT};">Pickup PIN<div style="margin-top:4px;"><span class="dm-pin" style="display:inline-block;background:${EMAIL_BRAND.ink};color:#fff;font-family:${EMAIL_FONT};font-size:13px;font-weight:700;letter-spacing:1px;padding:4px 8px;border-radius:8px;white-space:nowrap;">${escapeHtml(leg.pickupPin || "—")}</span></div></td>
            <td width="33%" valign="top" align="right" class="dm-muted-soft" style="width:33%;padding-top:16px;padding-left:6px;font-size:12px;color:${MUTED_SOFT};">Leg fare<div class="dm-ink" style="font-size:14px;font-weight:700;color:${EMAIL_BRAND.ink};margin-top:2px;white-space:nowrap;">${escapeHtml(fare)}</div></td>
          </tr>
        </table>
      </td></tr>
    </table>
  </td></tr>`
}

function peopleSection(primary: BookingTripLeg): string {
  const relation =
    primary.bookerRelation &&
    primary.bookerRelation in BOOKER_RELATION_LABELS
      ? BOOKER_RELATION_LABELS[primary.bookerRelation as BookerRelation]
      : null

  const bookerChip = primary.bookedForOther
    ? relation
      ? `Booker · ${relation}`
      : "Booker"
    : "Customer"

  const rows = [
    personRow({
      name: primary.customer.name,
      chip: bookerChip,
      email: primary.customer.email,
      phone: primary.customer.phone,
      accent: true,
      marginBottom: primary.bookedForOther,
    }),
  ]

  if (primary.bookedForOther) {
    rows.push(
      personRow({
        name: primary.passengerName?.trim() || "Passenger",
        chip: "Passenger",
        email: primary.passengerNoEmail ? null : primary.passengerEmail,
        phone: primary.passengerPhone,
        noEmail: primary.passengerNoEmail,
        accent: false,
      }),
    )
  }

  return `
  <tr><td class="px" style="padding:30px 40px 0;font-family:${EMAIL_FONT};">
    <div class="dm-ink" style="font-size:13px;font-weight:700;margin-bottom:14px;color:${EMAIL_BRAND.ink};">People</div>
    ${rows.join("")}
  </td></tr>`
}

function sumBalanceDue(legs: BookingTripLeg[]): number {
  return Number(
    legs
      .reduce((sum, leg) => sum + Number(leg.balanceDue), 0)
      .toFixed(2),
  )
}

function averageLegFare(legs: BookingTripLeg[]): number {
  if (legs.length === 0) return 0
  const total = legs.reduce((sum, leg) => sum + Number(leg.totalPrice), 0)
  return Number((total / legs.length).toFixed(2))
}

/** Full HTML email for booking confirmation (customer or admin ops alert). */
export function renderBookingTripEmail(opts: {
  audience: BookingTripEmailAudience
  bookingId: string
  legs: BookingTripLeg[]
  settings: Settings
  introHtml?: string
  preheader?: string
}): string {
  const legs = opts.legs
  const primary = legs[0]
  if (!primary) {
    throw new Error("renderBookingTripEmail requires at least one leg")
  }

  const isRoundTrip = legs.length > 1
  const company = companyName(opts.settings)
  const logoUrl = emailLogoUrl()
  const homeUrl = getAppBaseUrl()
  const currency = primary.currency
  const balance = money(sumBalanceDue(legs), currency)
  const perLeg = money(averageLegFare(legs), currency)

  const title =
    opts.audience === "admin"
      ? isRoundTrip
        ? "New round trip received"
        : "New single trip received"
      : isRoundTrip
        ? "Your round trip is booked"
        : "Your transfer is booked"

  const defaultIntro =
    opts.audience === "admin"
      ? isRoundTrip
        ? "A customer just confirmed a round-trip transfer. Review the details and assign drivers when ready."
        : "A customer just confirmed a one-way transfer. Review the details and assign a driver when ready."
      : `Hi ${escapeHtml(primary.customer.name)}, thanks for choosing <strong>${escapeHtml(company)}</strong>. ${
          isRoundTrip
            ? "Your outbound and return ride details are below."
            : "Your ride details are below."
        }`

  const introHtml = opts.introHtml ?? defaultIntro

  const refsLine = isRoundTrip
    ? legs.map((l) => l.referenceCode).join(" + ")
    : primary.referenceCode

  const preheader =
    opts.preheader?.trim() ||
    (opts.audience === "admin"
      ? isRoundTrip
        ? `New round trip · ${balance} · ${refsLine} — assign drivers when ready.`
        : `New single trip · ${balance} · ${primary.referenceCode} — assign a driver when ready.`
      : isRoundTrip
        ? `Round trip ${refsLine} is confirmed`
        : `Booking ${primary.referenceCode} is confirmed`)

  const amountMeta = isRoundTrip
    ? `${legs.length} legs &middot; ${escapeHtml(perLeg)} each<br>${legs
        .map(
          (l) =>
            `<span style="font-family:${EMAIL_FONT};">${escapeHtml(l.referenceCode)}</span>`,
        )
        .join("<br>")}`
    : `Single trip<br><span style="font-family:${EMAIL_FONT};">${escapeHtml(primary.referenceCode)}</span>`

  const chips = [
    vehicleLabel(primary.vehicleType),
    `${primary.passengerCount} passenger${primary.passengerCount === 1 ? "" : "s"}`,
    `${primary.luggageCount} bag${primary.luggageCount === 1 ? "" : "s"}`,
  ]

  const chipHtml = chips
    .map(
      (label, i) =>
        `${i > 0 ? '<td style="width:8px;"></td>' : ""}<td class="dm-chip" style="background:${CHIP_BG};border-radius:999px;padding:8px 14px;font-size:13px;font-weight:600;color:${EMAIL_BRAND.ink};font-family:${EMAIL_FONT};">${escapeHtml(label)}</td>`,
    )
    .join("")

  const legCards = legs
    .map((leg, i) =>
      legCard(leg, legLabel(i, legs.length), i === 0 ? "30px" : "14px"),
    )
    .join("")

  const ctaHref =
    opts.audience === "admin"
      ? adminBookingUrl(opts.bookingId)
      : manageBookingUrl()
  const ctaLabel =
    opts.audience === "admin" ? "Open in admin &nbsp;&rarr;" : "Manage booking"

  const footer =
    opts.audience === "admin"
      ? `Automated notification from ${escapeHtml(company)}.<br>Please do not reply to this email.`
      : escapeHtml(supportLine(opts.settings))

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light only" />
<meta name="supported-color-schemes" content="light only" />
<title>${escapeHtml(title)}</title>
<!-- Mulish webfont (Apple Mail / iOS / some Android; Gmail falls back to Arial) -->
<link href="${MULISH_FONT_URL}" rel="stylesheet" type="text/css" />
<style type="text/css">
  @import url('${MULISH_FONT_URL}');
  /* Re-enable custom dark for Apple Mail while meta stays "light only" for Gmail. */
  :root { color-scheme: light dark; supported-color-schemes: light dark; }
  body,table,td,th,p,div,h1,a,span{font-family:${EMAIL_FONT} !important;}
  body{margin:0;padding:0;background:${PAGE_BG};font-family:${EMAIL_FONT};}
  table{border-collapse:separate;border-spacing:0;}
  a{color:${EMAIL_BRAND.accent};}
  /* Fluid by default — Gmail mobile strips media queries, so do not rely on them for width. */
  .wrap{width:100% !important;max-width:600px !important;}
  @media only screen and (max-width:620px){
    .wrap{width:100%!important;max-width:100%!important;border-radius:0!important;}
    .px{padding-left:20px!important;padding-right:20px!important;}
    .hero-amt{font-size:34px!important;}
    .btn{display:block!important;text-align:center!important;}
  }
  @media (prefers-color-scheme: dark){
    body,.dm-page{background:#141a22 !important;}
    .dm-shell{background:#1b2330 !important;}
    .dm-card{background:#243041 !important;border-color:#334155 !important;box-shadow:none !important;}
    .dm-chip{background:#2f3b4d !important;color:#e8edf2 !important;}
    .dm-ink,.dm-ink strong,h1.dm-ink{color:#e8edf2 !important;}
    .dm-muted{color:#aeb8c6 !important;}
    .dm-muted-soft{color:#8b98a8 !important;}
    .dm-accent{color:#5eead4 !important;}
    .dm-tile{background:#1D9E75 !important;}
    .dm-avatar-soft{background:#1a3d32 !important;color:#6ee7b7 !important;}
    .dm-avatar-ink,.dm-pin,.dm-cta{background:#e8edf2 !important;color:#141a22 !important;}
    .dm-dot-ink{border-color:#e8edf2 !important;}
    .dm-dash{border-top-color:#3d4f5f !important;}
    .dm-link{color:#5eead4 !important;}
    .dm-footer{color:#8b98a8 !important;}
  }
</style>
<!--[if mso]>
<style type="text/css">
  body, table, td { font-family: Arial, Helvetica, sans-serif !important; }
</style>
<![endif]-->
</head>
<body class="dm-page" style="margin:0;padding:0;background:${PAGE_BG};font-family:${EMAIL_FONT};color:${EMAIL_BRAND.ink};-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${escapeHtml(preheader)}</div>

<table role="presentation" class="dm-page" width="100%" cellpadding="0" cellspacing="0" style="background:${PAGE_BG};width:100%;">
<tr><td align="center" style="padding:36px 12px;">

<!--[if mso]>
<table role="presentation" width="600" align="center" cellpadding="0" cellspacing="0" border="0"><tr><td>
<![endif]-->

<!-- Logo -->
<table role="presentation" class="wrap" width="100%" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;">
  <tr><td style="padding:0 8px 18px;">
    <a href="${escapeHtml(homeUrl)}" style="text-decoration:none;border:0;outline:none;">
      <img
        src="${escapeHtml(logoUrl)}"
        width="154"
        height="58"
        alt="${escapeHtml(company)}"
        style="display:block;width:154px;height:auto;max-width:154px;border:0;outline:none;text-decoration:none;"
      />
    </a>
  </td></tr>
</table>

<table role="presentation" class="wrap dm-shell" width="100%" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:24px;box-shadow:0 8px 30px rgba(29,60,50,0.08);">

  <!-- Hero -->
  <tr><td class="px" style="padding:40px 40px 8px;font-family:${EMAIL_FONT};">
    <h1 class="dm-ink" style="margin:0 0 10px;font-size:32px;line-height:1.15;font-weight:800;letter-spacing:-0.8px;color:${EMAIL_BRAND.ink};">${escapeHtml(title)}</h1>
    <p class="dm-muted" style="margin:0;font-size:16px;line-height:1.6;color:${MUTED};">${introHtml}</p>
  </td></tr>

  <!-- Amount tile: balance above, refs below (stacks cleanly on Gmail mobile) -->
  <tr><td class="px" style="padding:24px 40px 0;font-family:${EMAIL_FONT};">
    <table role="presentation" class="dm-tile" width="100%" cellpadding="0" cellspacing="0" style="background:${EMAIL_BRAND.accent};border-radius:18px;">
      <tr><td style="padding:24px 26px 8px;">
        <div style="font-size:12px;font-weight:600;letter-spacing:.6px;text-transform:uppercase;color:${AMOUNT_LABEL};">Balance due</div>
        <div class="hero-amt" style="font-size:42px;font-weight:800;letter-spacing:-1.2px;color:#ffffff;line-height:1.1;margin-top:4px;">${escapeHtml(balance)}</div>
      </td></tr>
      <tr><td style="padding:0 26px 24px;font-size:13px;line-height:1.7;color:${AMOUNT_META};">
        ${amountMeta}
      </td></tr>
    </table>
  </td></tr>

  <!-- Chips -->
  <tr><td class="px" style="padding:18px 40px 0;font-family:${EMAIL_FONT};">
    <table role="presentation" cellpadding="0" cellspacing="0"><tr>
      ${chipHtml}
    </tr></table>
  </td></tr>

  ${legCards}

  ${peopleSection(primary)}

  <!-- CTA -->
  <tr><td class="px" style="padding:34px 40px 40px;font-family:${EMAIL_FONT};">
    <a href="${escapeHtml(ctaHref)}" class="btn dm-cta" style="display:inline-block;background:${EMAIL_BRAND.ink};color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;padding:16px 32px;border-radius:999px;font-family:${EMAIL_FONT};">${ctaLabel}</a>
  </td></tr>
</table>

<p class="dm-footer" style="margin:22px 0 0;font-size:12px;line-height:1.6;color:${MUTED_SOFT};text-align:center;font-family:${EMAIL_FONT};">${footer}</p>

<!--[if mso]>
</td></tr></table>
<![endif]-->

</td></tr>
</table>
</body>
</html>`
}
