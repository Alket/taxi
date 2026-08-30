import {
  BOOKER_RELATION_LABELS,
  type BookerRelation,
} from "@/lib/booker-relation"
import type { NotificationType } from "@prisma/client"

import { prisma } from "@/lib/db"
import {
  getAppBaseUrl,
  isMailConfigured,
  sendMail,
} from "@/lib/mail"
import { takeRateLimit } from "@/lib/rate-limit"
import {
  getSettings,
  resolveAdminNotificationEmail,
} from "@/lib/settings"
import { extractEmailAddress } from "@/lib/smtp-security"
import type { NotificationChannels, Settings } from "@/lib/types"
import {
  adminBookingUrl,
  adminReviewsUrl,
  companyName,
  detailRow,
  escapeHtml,
  formatWhen,
  manageBookingUrl,
  money,
  paymentStatusLabel,
  reviewBookingUrl,
  supportLine,
  vehicleLabel,
  wrapEmail,
} from "@/lib/emails/templates"

type SendResult = { sent: boolean }

/** Only pass Reply-To when it is a real email — invalid values make some SMTPs reject the whole message. */
function safeReplyTo(settings: Settings): string | undefined {
  return extractEmailAddress(settings.supportEmail) ?? undefined
}

function channelEnabled(
  settings: Settings,
  key: keyof NotificationChannels,
): boolean {
  const value = settings.notificationChannelsEnabled?.[key]
  // Missing key → enabled (matches parseNotificationChannels defaults).
  return value !== false
}

const bookingSelect = {
  id: true,
  referenceCode: true,
  status: true,
  pickupPin: true,
  pickupAddress: true,
  dropoffAddress: true,
  pickupDateTime: true,
  flightNumber: true,
  vehicleType: true,
  passengerCount: true,
  luggageCount: true,
  meetAndGreet: true,
  currency: true,
  totalPrice: true,
  depositPaid: true,
  balanceDue: true,
  paymentStatus: true,
  cancellationOutcome: true,
  notes: true,
  bookedForOther: true,
  passengerName: true,
  passengerEmail: true,
  passengerPhone: true,
  passengerNoEmail: true,
  bookerRelation: true,
  isRoundTrip: true,
  roundTripId: true,
  customerId: true,
  driverId: true,
  customer: {
    select: { id: true, name: true, email: true, phone: true },
  },
  driver: {
    select: {
      name: true,
      phone: true,
      whatsappNumber: true,
      vehicleMake: true,
      vehicleModel: true,
      plateNumber: true,
    },
  },
} as const

type BookingEmailRow = {
  id: string
  referenceCode: string
  status: string
  pickupPin: string
  pickupAddress: string
  dropoffAddress: string
  pickupDateTime: Date
  flightNumber: string | null
  vehicleType: string
  passengerCount: number
  luggageCount: number
  meetAndGreet: boolean
  currency: string
  totalPrice: { toString(): string } | number
  depositPaid: { toString(): string } | number
  balanceDue: { toString(): string } | number
  paymentStatus: string
  cancellationOutcome: string | null
  notes: string | null
  bookedForOther: boolean
  passengerName: string | null
  passengerEmail: string | null
  passengerPhone: string | null
  passengerNoEmail: boolean
  bookerRelation: string | null
  isRoundTrip: boolean
  roundTripId: string | null
  customerId: string
  driverId: string | null
  customer: {
    id: string
    name: string
    email: string
    phone: string
  }
  driver: {
    name: string
    phone: string
    whatsappNumber: string
    vehicleMake: string
    vehicleModel: string
    plateNumber: string
  } | null
}

function isCashOnArrivalBooking(booking: { notes: string | null }): boolean {
  return (booking.notes?.toLowerCase() ?? "").includes("cash on arrival")
}

async function loadBooking(bookingId: string): Promise<BookingEmailRow | null> {
  return prisma.booking.findUnique({
    where: { id: bookingId },
    select: bookingSelect,
  }) as Promise<BookingEmailRow | null>
}

/**
 * Primary booking plus round-trip siblings (earliest pickup first).
 * One-way trips return a single-leg array.
 */
async function loadTripLegs(
  booking: BookingEmailRow,
): Promise<BookingEmailRow[]> {
  if (!booking.roundTripId) return [booking]
  const legs = (await prisma.booking.findMany({
    where: {
      roundTripId: booking.roundTripId,
      customerId: booking.customerId,
      status: { not: "cancelled" },
    },
    select: bookingSelect,
    orderBy: { pickupDateTime: "asc" },
  })) as BookingEmailRow[]
  return legs.length > 0 ? legs : [booking]
}

function sumMoneyField(
  legs: BookingEmailRow[],
  field: "totalPrice" | "depositPaid" | "balanceDue",
): number {
  return Number(
    legs
      .reduce((sum, leg) => sum + Number(leg[field]), 0)
      .toFixed(2),
  )
}

function tripReferenceLabel(legs: BookingEmailRow[]): string {
  return legs.map((leg) => leg.referenceCode).join(" + ")
}

function legDetailRows(leg: BookingEmailRow, label: string): string {
  return [
    detailRow("Leg", label),
    detailRow("Reference", leg.referenceCode),
    leg.pickupPin ? detailRow("Pickup PIN", leg.pickupPin) : "",
    detailRow("Pickup", leg.pickupAddress),
    detailRow("Drop-off", leg.dropoffAddress),
    detailRow("When", formatWhen(leg.pickupDateTime)),
    leg.flightNumber ? detailRow("Flight", leg.flightNumber) : "",
    detailRow(
      "Leg fare",
      money(Number(leg.totalPrice), leg.currency),
    ),
  ].join("")
}

function legDetailTextLines(leg: BookingEmailRow, label: string): string[] {
  return [
    `${label}:`,
    `  Reference: ${leg.referenceCode}`,
    leg.pickupPin ? `  Pickup PIN: ${leg.pickupPin}` : null,
    `  Pickup: ${leg.pickupAddress}`,
    `  Drop-off: ${leg.dropoffAddress}`,
    `  When: ${formatWhen(leg.pickupDateTime)}`,
    leg.flightNumber ? `  Flight: ${leg.flightNumber}` : null,
    `  Leg fare: ${money(Number(leg.totalPrice), leg.currency)}`,
  ].filter((line): line is string => Boolean(line))
}

/** Shared + per-leg rows for confirmation emails (one-way or round trip). */
function tripCustomerRows(legs: BookingEmailRow[]): string {
  const primary = legs[0]!
  if (legs.length === 1) return baseCustomerRows(primary)

  return [
    detailRow("Trip", "Round trip"),
    detailRow("Vehicle", vehicleLabel(primary.vehicleType)),
    detailRow("Passengers", String(primary.passengerCount)),
    detailRow("Luggage", String(primary.luggageCount)),
    passengerEmailRows(primary),
    legDetailRows(legs[0]!, "Outbound"),
    legDetailRows(legs[1]!, "Return"),
    ...legs.slice(2).map((leg, i) => legDetailRows(leg, `Leg ${i + 3}`)),
  ].join("")
}

function tripCustomerTextLines(legs: BookingEmailRow[]): string[] {
  const primary = legs[0]!
  if (legs.length === 1) return baseCustomerTextLines(primary)

  return [
    "Trip: Round trip",
    `Vehicle: ${vehicleLabel(primary.vehicleType)}`,
    `Passengers: ${primary.passengerCount}`,
    `Luggage: ${primary.luggageCount}`,
    ...passengerEmailTextLines(primary),
    "",
    ...legDetailTextLines(legs[0]!, "Outbound"),
    "",
    ...legDetailTextLines(legs[1]!, "Return"),
    ...legs.slice(2).flatMap((leg, i) => [
      "",
      ...legDetailTextLines(leg, `Leg ${i + 3}`),
    ]),
  ]
}

function tripPriceRows(legs: BookingEmailRow[]): string {
  const primary = legs[0]!
  const cashOnArrival = isCashOnArrivalBooking(primary)
  const currency = primary.currency
  if (legs.length === 1) return priceRows(primary)

  return [
    detailRow("Trip total", money(sumMoneyField(legs, "totalPrice"), currency)),
    cashOnArrival
      ? ""
      : detailRow(
          "Paid",
          money(sumMoneyField(legs, "depositPaid"), currency),
        ),
    detailRow(
      "Balance due",
      money(sumMoneyField(legs, "balanceDue"), currency),
    ),
  ].join("")
}

function tripPriceTextLines(legs: BookingEmailRow[]): string[] {
  const primary = legs[0]!
  const cashOnArrival = isCashOnArrivalBooking(primary)
  const currency = primary.currency
  if (legs.length === 1) return priceTextLines(primary)

  return [
    `Trip total: ${money(sumMoneyField(legs, "totalPrice"), currency)}`,
    cashOnArrival
      ? null
      : `Paid: ${money(sumMoneyField(legs, "depositPaid"), currency)}`,
    `Balance due: ${money(sumMoneyField(legs, "balanceDue"), currency)}`,
  ].filter((line): line is string => Boolean(line))
}

async function logAndSend(input: {
  to: string
  subject: string
  text: string
  html: string
  type: NotificationType
  bookingId?: string | null
  customerId?: string | null
  replyTo?: string
}): Promise<SendResult> {
  if (!(await isMailConfigured())) return { sent: false }

  const to = extractEmailAddress(input.to)
  if (!to) {
    console.error(`[mail] ${input.type} skipped: invalid recipient`, input.to)
    return { sent: false }
  }

  const replyTo = input.replyTo
    ? extractEmailAddress(input.replyTo) ?? undefined
    : undefined

  const log = await prisma.notificationLog.create({
    data: {
      bookingId: input.bookingId ?? null,
      customerId: input.customerId ?? null,
      channel: "email",
      type: input.type,
      status: "pending",
      recipient: to,
      subject: input.subject,
      body: input.text,
    },
  })

  try {
    const result = await sendMail({
      to,
      subject: input.subject,
      text: input.text,
      html: input.html,
      replyTo,
    })
    await prisma.notificationLog.update({
      where: { id: log.id },
      data: {
        status: "sent",
        sentAt: new Date(),
        // Reuse errorMessage as a short delivery trace (message-id + SMTP reply).
        errorMessage: [
          result.messageId ? `id=${result.messageId}` : null,
          result.response ? `smtp=${result.response}` : null,
        ]
          .filter(Boolean)
          .join(" · ")
          .slice(0, 500) || null,
      },
    })
    return { sent: true }
  } catch (error) {
    await prisma.notificationLog.update({
      where: { id: log.id },
      data: {
        status: "failed",
        errorMessage: (error as Error).message || "Send failed",
      },
    })
    console.error(`[mail] ${input.type} → ${to} failed:`, error)
    return { sent: false }
  }
}

function passengerEmailRows(booking: BookingEmailRow): string {
  if (!booking.bookedForOther) return ""
  const relation =
    booking.bookerRelation &&
    booking.bookerRelation in BOOKER_RELATION_LABELS
      ? BOOKER_RELATION_LABELS[booking.bookerRelation as BookerRelation]
      : null
  return [
    detailRow("Passenger", booking.passengerName || "—"),
    booking.passengerNoEmail
      ? detailRow("Passenger email", "Not provided")
      : booking.passengerEmail
        ? detailRow("Passenger email", booking.passengerEmail)
        : "",
    booking.passengerPhone
      ? detailRow("Passenger phone", booking.passengerPhone)
      : "",
    relation ? detailRow("Booker relation", relation) : "",
  ].join("")
}

function passengerEmailTextLines(booking: BookingEmailRow): string[] {
  if (!booking.bookedForOther) return []
  const relation =
    booking.bookerRelation &&
    booking.bookerRelation in BOOKER_RELATION_LABELS
      ? BOOKER_RELATION_LABELS[booking.bookerRelation as BookerRelation]
      : null
  return [
    `Passenger: ${booking.passengerName || "—"}`,
    booking.passengerNoEmail
      ? "Passenger email: Not provided"
      : booking.passengerEmail
        ? `Passenger email: ${booking.passengerEmail}`
        : null,
    booking.passengerPhone
      ? `Passenger phone: ${booking.passengerPhone}`
      : null,
    relation ? `Booker relation: ${relation}` : null,
  ].filter((line): line is string => Boolean(line))
}

function baseCustomerRows(booking: BookingEmailRow): string {
  return [
    detailRow("Reference", booking.referenceCode),
    booking.pickupPin ? detailRow("Pickup PIN", booking.pickupPin) : "",
    detailRow("Pickup", booking.pickupAddress),
    detailRow("Drop-off", booking.dropoffAddress),
    detailRow("When", formatWhen(booking.pickupDateTime)),
    booking.flightNumber ? detailRow("Flight", booking.flightNumber) : "",
    detailRow("Vehicle", vehicleLabel(booking.vehicleType)),
    detailRow("Passengers", String(booking.passengerCount)),
    detailRow("Luggage", String(booking.luggageCount)),
    passengerEmailRows(booking),
  ].join("")
}

/** Plain-text trip details — same fields as baseCustomerRows. */
function baseCustomerTextLines(booking: BookingEmailRow): string[] {
  return [
    `Reference: ${booking.referenceCode}`,
    booking.pickupPin ? `Pickup PIN: ${booking.pickupPin}` : null,
    `Pickup: ${booking.pickupAddress}`,
    `Drop-off: ${booking.dropoffAddress}`,
    `When: ${formatWhen(booking.pickupDateTime)}`,
    booking.flightNumber ? `Flight: ${booking.flightNumber}` : null,
    `Vehicle: ${vehicleLabel(booking.vehicleType)}`,
    `Passengers: ${booking.passengerCount}`,
    `Luggage: ${booking.luggageCount}`,
    ...passengerEmailTextLines(booking),
  ].filter((line): line is string => Boolean(line))
}

function priceRows(booking: BookingEmailRow): string {
  const cashOnArrival = isCashOnArrivalBooking(booking)
  return [
    detailRow("Total", money(Number(booking.totalPrice), booking.currency)),
    cashOnArrival
      ? ""
      : detailRow("Paid", money(Number(booking.depositPaid), booking.currency)),
    detailRow("Balance due", money(Number(booking.balanceDue), booking.currency)),
  ].join("")
}

function priceTextLines(booking: BookingEmailRow): string[] {
  const cashOnArrival = isCashOnArrivalBooking(booking)
  return [
    `Total: ${money(Number(booking.totalPrice), booking.currency)}`,
    cashOnArrival
      ? null
      : `Paid: ${money(Number(booking.depositPaid), booking.currency)}`,
    `Balance due: ${money(Number(booking.balanceDue), booking.currency)}`,
  ].filter((line): line is string => Boolean(line))
}

function adminCustomerRows(booking: BookingEmailRow): string {
  const bookerLabel = booking.bookedForOther ? "Booker" : "Customer"
  return [
    detailRow(bookerLabel, booking.customer.name),
    detailRow("Email", booking.customer.email),
    detailRow("Phone", booking.customer.phone),
    passengerEmailRows(booking),
  ].join("")
}

/**
 * Confirmation trip snapshot (legs + combined totals + text body).
 * Exported for QA scripts — same data used by confirmation emails.
 */
export async function getConfirmationTripSnapshot(bookingId: string) {
  const booking = await loadBooking(bookingId)
  if (!booking) return null
  const legs = await loadTripLegs(booking)
  return {
    bookingId: booking.id,
    customerId: booking.customerId,
    roundTripId: booking.roundTripId,
    isRoundTrip: legs.length > 1,
    references: legs.map((leg) => leg.referenceCode),
    legIds: legs.map((leg) => leg.id),
    customerIds: [...new Set(legs.map((leg) => leg.customerId))],
    pickupAddresses: legs.map((leg) => leg.pickupAddress),
    tripTotal: sumMoneyField(legs, "totalPrice"),
    depositPaid: sumMoneyField(legs, "depositPaid"),
    balanceDue: sumMoneyField(legs, "balanceDue"),
    textBody: [
      ...tripCustomerTextLines(legs),
      "",
      ...tripPriceTextLines(legs),
    ].join("\n"),
  }
}

/** Sends customer confirmation first, then admin alert (sequential for shared SMTP hosts). */
export async function sendBookingConfirmationEmail(
  bookingId: string,
): Promise<SendResult> {
  let customer = await sendCustomerBookingConfirmation(bookingId)
  if (!customer.sent) {
    // One retry — shared SMTP hosts sometimes drop the first attempt.
    customer = await sendCustomerBookingConfirmation(bookingId)
    if (!customer.sent) {
      console.error(
        `[mail] customer confirmation not sent for booking ${bookingId}`,
      )
    }
  }
  const admin = await sendAdminNewBooking(bookingId)
  return { sent: customer.sent || admin.sent }
}

export async function sendCustomerBookingConfirmation(
  bookingId: string,
): Promise<SendResult> {
  try {
    if (!(await isMailConfigured())) return { sent: false }
    const settings = await getSettings()
    if (!channelEnabled(settings, "confirmation")) {
      console.warn(
        `[mail] customer confirmation skipped — channel disabled (booking ${bookingId})`,
      )
      return { sent: false }
    }

    const booking = await loadBooking(bookingId)
    if (!booking?.customer.email) return { sent: false }

    const legs = await loadTripLegs(booking)
    const isRoundTrip = legs.length > 1
    const refs = tripReferenceLabel(legs)
    const company = companyName(settings)
    const manageUrl = manageBookingUrl()
    const cashOnArrival = isCashOnArrivalBooking(booking)
    const subject = isRoundTrip
      ? `Round trip confirmed — ${refs}`
      : `Booking confirmed — ${booking.referenceCode}`
    const text = [
      `Hi ${booking.customer.name},`,
      "",
      isRoundTrip
        ? `Your round-trip transfer with ${company} is confirmed.`
        : `Your transfer with ${company} is confirmed.`,
      "",
      ...tripCustomerTextLines(legs),
      "",
      ...tripPriceTextLines(legs),
      "",
      ...(cashOnArrival
        ? [
            "Payment: Pay the full amount in cash to your driver at pickup.",
            "",
          ]
        : [
            "Cancellation: Cancelling forfeits the deposit paid — it is not refunded. The remaining balance is never charged. If a driver fails to show or the service is not delivered, contact support for a full refund.",
            "",
          ]),
      `Manage: ${manageUrl}`,
      supportLine(settings),
    ].join("\n")

    const html = wrapEmail({
      company,
      eyebrow: "Confirmed",
      tone: "success",
      preheader: isRoundTrip
        ? `Round trip ${refs} is confirmed`
        : `Booking ${booking.referenceCode} is confirmed`,
      title: isRoundTrip
        ? "Your round trip is booked"
        : "Your transfer is booked",
      introHtml: `Hi ${escapeHtml(booking.customer.name)}, thanks for choosing <strong>${escapeHtml(company)}</strong>. ${
        isRoundTrip
          ? "Your outbound and return ride details are below."
          : "Your ride details are below."
      }`,
      rowsHtml:
        tripCustomerRows(legs) +
        tripPriceRows(legs) +
        (cashOnArrival
          ? detailRow(
              "Payment",
              "Pay the full amount in cash to your driver at pickup.",
            )
          : detailRow(
              "Cancellation",
              "Cancelling forfeits the deposit (no refund). Unpaid balance is never charged.",
            )),
      cta: { href: manageUrl, label: "Manage booking" },
      footer: supportLine(settings),
    })

    return logAndSend({
      to: booking.customer.email,
      subject,
      text,
      html,
      type: "confirmation",
      bookingId: booking.id,
      customerId: booking.customerId,
      replyTo: safeReplyTo(settings),
    })
  } catch (error) {
    console.error("[mail] customer confirmation setup failed:", error)
    return { sent: false }
  }
}

export async function sendAdminNewBooking(
  bookingId: string,
): Promise<SendResult> {
  try {
    if (!(await isMailConfigured())) return { sent: false }
    const settings = await getSettings()
    const to = resolveAdminNotificationEmail(settings)
    if (!to) return { sent: false }

    const booking = await loadBooking(bookingId)
    if (!booking) return { sent: false }

    const legs = await loadTripLegs(booking)
    const isRoundTrip = legs.length > 1
    const refs = tripReferenceLabel(legs)
    const link = adminBookingUrl(booking.id)
    const subject = isRoundTrip
      ? `New round trip — ${refs}`
      : `New booking — ${booking.referenceCode}`
    const text = [
      isRoundTrip
        ? `New round trip ${refs}`
        : `New booking ${booking.referenceCode}`,
      "",
      `Customer: ${booking.customer.name} (${booking.customer.email}, ${booking.customer.phone})`,
      ...tripCustomerTextLines(legs),
      "",
      ...tripPriceTextLines(legs),
      "",
      `Open: ${link}`,
    ].join("\n")

    const html = wrapEmail({
      company: companyName(settings),
      eyebrow: "Ops alert",
      tone: "default",
      preheader: isRoundTrip
        ? `New round trip ${refs}`
        : `New booking ${booking.referenceCode}`,
      title: isRoundTrip ? "New round trip received" : "New booking received",
      introHtml: isRoundTrip
        ? `A customer just confirmed a round-trip transfer (${escapeHtml(refs)}). Review and assign drivers when ready.`
        : `A customer just confirmed a transfer. Review and assign a driver when ready.`,
      rowsHtml:
        adminCustomerRows(booking) +
        tripCustomerRows(legs) +
        tripPriceRows(legs),
      cta: { href: link, label: "Open in admin" },
      footer: `Ops inbox · ${getAppBaseUrl()}`,
    })

    return logAndSend({
      to,
      subject,
      text,
      html,
      type: "confirmation",
      bookingId: booking.id,
      customerId: booking.customerId,
    })
  } catch (error) {
    console.error("[mail] admin new booking setup failed:", error)
    return { sent: false }
  }
}

export async function sendCustomerCancellation(
  bookingId: string,
): Promise<SendResult> {
  try {
    if (!(await isMailConfigured())) return { sent: false }
    const settings = await getSettings()
    if (!channelEnabled(settings, "cancellation")) return { sent: false }

    const booking = await loadBooking(bookingId)
    if (!booking?.customer.email) return { sent: false }

    const outcome =
      "The deposit paid has been forfeited and will not be refunded. Any unpaid balance will not be charged."

    const subject = `Booking cancelled — ${booking.referenceCode}`
    const text = [
      `Hi ${booking.customer.name},`,
      "",
      `Your booking ${booking.referenceCode} has been cancelled.`,
      outcome,
      "",
      `Pickup was: ${booking.pickupAddress} → ${booking.dropoffAddress}`,
      `When: ${formatWhen(booking.pickupDateTime)}`,
      "",
      supportLine(settings),
    ].join("\n")

    const html = wrapEmail({
      company: companyName(settings),
      eyebrow: "Cancelled",
      tone: "danger",
      preheader: `Booking ${booking.referenceCode} cancelled`,
      title: "Booking cancelled",
      introHtml: `Hi ${escapeHtml(booking.customer.name)}, booking <strong>${escapeHtml(booking.referenceCode)}</strong> has been cancelled.<br/><br/>${escapeHtml(outcome)}`,
      rowsHtml: baseCustomerRows(booking),
      cta: { href: manageBookingUrl(), label: "My bookings" },
      footer: supportLine(settings),
    })

    return logAndSend({
      to: booking.customer.email,
      subject,
      text,
      html,
      type: "cancellation",
      bookingId: booking.id,
      customerId: booking.customerId,
      replyTo: safeReplyTo(settings),
    })
  } catch (error) {
    console.error("[mail] customer cancellation setup failed:", error)
    return { sent: false }
  }
}

export async function sendAdminCancellation(
  bookingId: string,
): Promise<SendResult> {
  try {
    if (!(await isMailConfigured())) return { sent: false }
    const settings = await getSettings()
    const to = resolveAdminNotificationEmail(settings)
    if (!to) return { sent: false }

    const booking = await loadBooking(bookingId)
    if (!booking) return { sent: false }

    const link = adminBookingUrl(booking.id)
    const outcomeLabel =
      booking.cancellationOutcome === "deposit_forfeited"
        ? "Deposit forfeited (no refund)"
        : booking.cancellationOutcome === "free_cancellation"
          ? "Legacy free cancellation"
          : "Cancelled"
    const subject = `Booking cancelled — ${booking.referenceCode}`
    const text = [
      `Booking ${booking.referenceCode} was cancelled (${outcomeLabel}).`,
      `Customer: ${booking.customer.name} · ${booking.customer.email}`,
      `When: ${formatWhen(booking.pickupDateTime)}`,
      `Open: ${link}`,
    ].join("\n")

    const html = wrapEmail({
      company: companyName(settings),
      eyebrow: "Ops alert",
      tone: "danger",
      preheader: `Cancelled ${booking.referenceCode}`,
      title: "Booking cancelled",
      introHtml: `Outcome: <strong>${escapeHtml(outcomeLabel)}</strong>`,
      rowsHtml: adminCustomerRows(booking) + baseCustomerRows(booking),
      cta: { href: link, label: "Open in admin" },
      footer: "Ops inbox",
    })

    return logAndSend({
      to,
      subject,
      text,
      html,
      type: "cancellation",
      bookingId: booking.id,
      customerId: booking.customerId,
    })
  } catch (error) {
    console.error("[mail] admin cancellation setup failed:", error)
    return { sent: false }
  }
}

export async function notifyBookingCancelled(
  bookingId: string,
): Promise<void> {
  await Promise.all([
    sendCustomerCancellation(bookingId),
    sendAdminCancellation(bookingId),
  ])

  try {
    const booking = await loadBooking(bookingId)
    if (!booking) return
    const { notifyAdminsBookingCancelled } = await import(
      "@/lib/push-notifications"
    )
    notifyAdminsBookingCancelled({
      bookingId: booking.id,
      referenceCode: booking.referenceCode,
      customerName: booking.customer.name,
      pickupAddress: booking.pickupAddress,
      dropoffAddress: booking.dropoffAddress,
    })
  } catch (error) {
    console.error("[notify] admin cancel inbox failed:", error)
  }
}

export async function sendCustomerDateChange(
  bookingId: string,
  previousPickup: Date,
): Promise<SendResult> {
  try {
    if (!(await isMailConfigured())) return { sent: false }
    const settings = await getSettings()
    if (!channelEnabled(settings, "dateChange")) return { sent: false }

    const booking = await loadBooking(bookingId)
    if (!booking?.customer.email) return { sent: false }

    const subject = `Pickup time updated — ${booking.referenceCode}`
    const text = [
      `Hi ${booking.customer.name},`,
      "",
      `Your pickup time for ${booking.referenceCode} was changed.`,
      `Previous: ${formatWhen(previousPickup)}`,
      `New: ${formatWhen(booking.pickupDateTime)}`,
      "",
      `Route: ${booking.pickupAddress} → ${booking.dropoffAddress}`,
      `Manage: ${manageBookingUrl()}`,
      supportLine(settings),
    ].join("\n")

    const html = wrapEmail({
      company: companyName(settings),
      eyebrow: "Schedule update",
      tone: "warning",
      preheader: `New pickup time for ${booking.referenceCode}`,
      title: "Pickup time updated",
      introHtml: `Hi ${escapeHtml(booking.customer.name)}, the pickup time for <strong>${escapeHtml(booking.referenceCode)}</strong> has changed. Please check the new schedule.`,
      rowsHtml:
        detailRow("Previous time", formatWhen(previousPickup)) +
        detailRow("New time", formatWhen(booking.pickupDateTime)) +
        detailRow("Pickup", booking.pickupAddress) +
        detailRow("Drop-off", booking.dropoffAddress),
      cta: { href: manageBookingUrl(), label: "Manage booking" },
      footer: supportLine(settings),
    })

    return logAndSend({
      to: booking.customer.email,
      subject,
      text,
      html,
      type: "date_change",
      bookingId: booking.id,
      customerId: booking.customerId,
      replyTo: safeReplyTo(settings),
    })
  } catch (error) {
    console.error("[mail] customer date change setup failed:", error)
    return { sent: false }
  }
}

export async function sendAdminDateChange(
  bookingId: string,
  previousPickup: Date,
): Promise<SendResult> {
  try {
    if (!(await isMailConfigured())) return { sent: false }
    const settings = await getSettings()
    const to = resolveAdminNotificationEmail(settings)
    if (!to) return { sent: false }

    const booking = await loadBooking(bookingId)
    if (!booking) return { sent: false }

    const link = adminBookingUrl(booking.id)
    const subject = `Date changed — ${booking.referenceCode}`
    const text = [
      `Pickup time changed for ${booking.referenceCode}`,
      `Previous: ${formatWhen(previousPickup)}`,
      `New: ${formatWhen(booking.pickupDateTime)}`,
      `Customer: ${booking.customer.name}`,
      `Open: ${link}`,
    ].join("\n")

    const html = wrapEmail({
      company: companyName(settings),
      eyebrow: "Ops alert",
      tone: "warning",
      preheader: `Date changed ${booking.referenceCode}`,
      title: "Pickup time changed",
      introHtml: `Booking <strong>${escapeHtml(booking.referenceCode)}</strong> schedule was updated.`,
      rowsHtml:
        adminCustomerRows(booking) +
        detailRow("Previous time", formatWhen(previousPickup)) +
        detailRow("New time", formatWhen(booking.pickupDateTime)) +
        detailRow("Pickup", booking.pickupAddress) +
        detailRow("Drop-off", booking.dropoffAddress),
      cta: { href: link, label: "Open in admin" },
      footer: "Ops inbox",
    })

    return logAndSend({
      to,
      subject,
      text,
      html,
      type: "date_change",
      bookingId: booking.id,
      customerId: booking.customerId,
    })
  } catch (error) {
    console.error("[mail] admin date change setup failed:", error)
    return { sent: false }
  }
}

/** At most one admin email per booking for date_change in this window. */
const DATE_CHANGE_ADMIN_MAIL_WINDOW_MS = 10 * 60 * 1000

export async function notifyBookingDateChanged(
  bookingId: string,
  previousPickup: Date,
): Promise<void> {
  const adminMailOk = takeRateLimit(
    `admin-mail:date-change:${bookingId}`,
    1,
    DATE_CHANGE_ADMIN_MAIL_WINDOW_MS,
  )

  await Promise.all([
    sendCustomerDateChange(bookingId, previousPickup),
    adminMailOk.ok
      ? sendAdminDateChange(bookingId, previousPickup)
      : Promise.resolve({ sent: false as const }),
  ])

  try {
    const booking = await loadBooking(bookingId)
    if (!booking) return
    const { notifyAdminsDateChanged } = await import(
      "@/lib/push-notifications"
    )
    notifyAdminsDateChanged({
      bookingId: booking.id,
      referenceCode: booking.referenceCode,
      customerName: booking.customer.name,
      previousPickupLabel: formatWhen(previousPickup),
      newPickupLabel: formatWhen(booking.pickupDateTime),
    })
  } catch (error) {
    console.error("[notify] admin date-change inbox failed:", error)
  }
}

export async function sendCustomerDriverAssigned(
  bookingId: string,
): Promise<SendResult> {
  try {
    if (!(await isMailConfigured())) return { sent: false }
    const settings = await getSettings()
    if (!channelEnabled(settings, "driverAssigned")) return { sent: false }

    const booking = await loadBooking(bookingId)
    if (!booking?.customer.email || !booking.driver) return { sent: false }

    const d = booking.driver
    const contact = d.whatsappNumber || d.phone
    const vehicle = [d.vehicleMake, d.vehicleModel].filter(Boolean).join(" ")
    const subject = `Driver assigned — ${booking.referenceCode}`
    const text = [
      `Hi ${booking.customer.name},`,
      "",
      `Your driver for ${booking.referenceCode} is ${d.name}.`,
      `Phone: ${d.phone}`,
      d.whatsappNumber ? `WhatsApp: ${d.whatsappNumber}` : null,
      vehicle ? `Vehicle: ${vehicle}` : null,
      d.plateNumber ? `Plate: ${d.plateNumber}` : null,
      "",
      `Pickup: ${formatWhen(booking.pickupDateTime)}`,
      `${booking.pickupAddress} → ${booking.dropoffAddress}`,
      booking.pickupPin ? `Pickup PIN: ${booking.pickupPin}` : null,
      `Passengers: ${booking.passengerCount}`,
      `Luggage: ${booking.luggageCount}`,
      "",
      `Manage: ${manageBookingUrl()}`,
      supportLine(settings),
    ]
      .filter(Boolean)
      .join("\n")

    const html = wrapEmail({
      company: companyName(settings),
      eyebrow: "Driver confirmed",
      tone: "success",
      preheader: `${d.name} is your driver · ${contact}`,
      title: "Your driver confirmed",
      introHtml: `Hi ${escapeHtml(booking.customer.name)}, <strong>${escapeHtml(d.name)}</strong> has accepted your transfer. Save their number so you can reach them easily.`,
      rowsHtml:
        detailRow("Driver", d.name) +
        detailRow("Phone", d.phone) +
        (d.whatsappNumber ? detailRow("WhatsApp", d.whatsappNumber) : "") +
        (vehicle ? detailRow("Vehicle", vehicle) : "") +
        (d.plateNumber ? detailRow("Plate", d.plateNumber) : "") +
        detailRow("Best contact", contact) +
        baseCustomerRows(booking),
      cta: { href: manageBookingUrl(), label: "Manage booking" },
      footer: supportLine(settings),
    })

    return logAndSend({
      to: booking.customer.email,
      subject,
      text,
      html,
      type: "driver_assigned",
      bookingId: booking.id,
      customerId: booking.customerId,
      replyTo: safeReplyTo(settings),
    })
  } catch (error) {
    console.error("[mail] driver assigned setup failed:", error)
    return { sent: false }
  }
}

export async function sendCustomerPickupReminder(
  bookingId: string,
): Promise<SendResult> {
  try {
    if (!(await isMailConfigured())) return { sent: false }
    const settings = await getSettings()
    if (!channelEnabled(settings, "reminder")) return { sent: false }

    const booking = await loadBooking(bookingId)
    if (!booking?.customer.email) return { sent: false }

    const subject = `Pickup reminder — ${booking.referenceCode}`
    const text = [
      `Hi ${booking.customer.name},`,
      "",
      `Reminder: your transfer ${booking.referenceCode} is coming up.`,
      ...baseCustomerTextLines(booking),
      booking.driver
        ? `Driver: ${booking.driver.name} · ${booking.driver.phone}`
        : null,
      "",
      `Manage: ${manageBookingUrl()}`,
      supportLine(settings),
    ]
      .filter(Boolean)
      .join("\n")

    const html = wrapEmail({
      company: companyName(settings),
      eyebrow: "Reminder",
      tone: "default",
      preheader: `Pickup soon · ${booking.referenceCode}`,
      title: "Your transfer is tomorrow",
      introHtml: `Hi ${escapeHtml(booking.customer.name)}, this is a friendly reminder for booking <strong>${escapeHtml(booking.referenceCode)}</strong>. Please be ready a few minutes early.`,
      rowsHtml:
        baseCustomerRows(booking) +
        (booking.driver
          ? detailRow(
              "Driver",
              `${booking.driver.name} · ${booking.driver.phone}`,
            )
          : ""),
      cta: { href: manageBookingUrl(), label: "Manage booking" },
      footer: supportLine(settings),
    })

    return logAndSend({
      to: booking.customer.email,
      subject,
      text,
      html,
      type: "reminder",
      bookingId: booking.id,
      customerId: booking.customerId,
      replyTo: safeReplyTo(settings),
    })
  } catch (error) {
    console.error("[mail] pickup reminder setup failed:", error)
    return { sent: false }
  }
}

/**
 * One recovery email after a public checkout is marked Abandoned.
 * Skips when a newer confirmed+ booking already exists for the same email.
 */
export async function sendCheckoutAbandonedEmail(
  bookingId: string,
): Promise<SendResult> {
  try {
    if (!(await isMailConfigured())) return { sent: false }
    const settings = await getSettings()
    if (!channelEnabled(settings, "checkoutAbandoned")) return { sent: false }

    const booking = await loadBooking(bookingId)
    if (!booking?.customer.email) return { sent: false }

    if (
      booking.status !== "abandoned" ||
      booking.paymentStatus !== "unpaid"
    ) {
      return { sent: false }
    }

    const already = await prisma.notificationLog.findFirst({
      where: {
        bookingId: booking.id,
        type: "checkout_abandoned",
        status: { in: ["sent", "pending"] },
      },
      select: { id: true },
    })
    if (already) return { sent: false }

    const newerConfirmed = await prisma.booking.findFirst({
      where: {
        customerId: booking.customerId,
        createdAt: { gt: booking.createdAt },
        status: {
          notIn: ["pending", "abandoned", "cancelled"],
        },
      },
      select: { id: true },
    })
    if (newerConfirmed) return { sent: false }

    const {
      checkoutContinueUrl,
      signCheckoutResumeToken,
    } = await import("@/lib/checkout-resume")
    const token = await signCheckoutResumeToken(booking.id)
    const continueUrl = checkoutContinueUrl(booking.referenceCode, token)

    const subject = `Complete your booking — ${booking.referenceCode}`
    const text = [
      `Hi ${booking.customer.name},`,
      "",
      `You started booking ${booking.referenceCode} but did not finish checkout.`,
      ...baseCustomerTextLines(booking),
      "",
      `Continue here: ${continueUrl}`,
      "",
      "If you already made another booking, you can ignore this email.",
      supportLine(settings),
    ]
      .filter(Boolean)
      .join("\n")

    const html = wrapEmail({
      company: companyName(settings),
      eyebrow: "Checkout incomplete",
      tone: "warning",
      preheader: `Finish ${booking.referenceCode}`,
      title: "Continue your booking",
      introHtml: `Hi ${escapeHtml(booking.customer.name)}, you started transfer <strong>${escapeHtml(booking.referenceCode)}</strong> but did not complete payment. You can finish the same booking below.`,
      rowsHtml: baseCustomerRows(booking),
      cta: { href: continueUrl, label: "Continue booking" },
      footer: supportLine(settings),
    })

    return logAndSend({
      to: booking.customer.email,
      subject,
      text,
      html,
      type: "checkout_abandoned",
      bookingId: booking.id,
      customerId: booking.customerId,
      replyTo: safeReplyTo(settings),
    })
  } catch (error) {
    console.error("[mail] checkout abandoned setup failed:", error)
    return { sent: false }
  }
}

export async function sendCustomerCompletedReceipt(
  bookingId: string,
): Promise<SendResult> {
  try {
    if (!(await isMailConfigured())) return { sent: false }
    const settings = await getSettings()
    if (!channelEnabled(settings, "completedReceipt")) return { sent: false }

    const booking = await loadBooking(bookingId)
    if (!booking?.customer.email) return { sent: false }

    const subject = `Trip completed — ${booking.referenceCode}`
    const text = [
      `Hi ${booking.customer.name},`,
      "",
      `Thanks for riding with ${companyName(settings)}.`,
      `Trip ${booking.referenceCode} is complete.`,
      "",
      `Route: ${booking.pickupAddress} → ${booking.dropoffAddress}`,
      `When: ${formatWhen(booking.pickupDateTime)}`,
      ...priceTextLines(booking),
      `Payment status: ${paymentStatusLabel(booking.paymentStatus)}`,
      "",
      supportLine(settings),
    ].join("\n")

    const html = wrapEmail({
      company: companyName(settings),
      eyebrow: "Completed",
      tone: "success",
      preheader: `Receipt for ${booking.referenceCode}`,
      title: "Thanks for riding with us",
      introHtml: `Hi ${escapeHtml(booking.customer.name)}, your trip is complete. Here is a quick receipt for your records.`,
      rowsHtml:
        baseCustomerRows(booking) +
        priceRows(booking) +
        detailRow("Payment status", paymentStatusLabel(booking.paymentStatus)),
      cta: { href: manageBookingUrl(), label: "View booking" },
      footer: supportLine(settings),
    })

    return logAndSend({
      to: booking.customer.email,
      subject,
      text,
      html,
      type: "completed_receipt",
      bookingId: booking.id,
      customerId: booking.customerId,
      replyTo: safeReplyTo(settings),
    })
  } catch (error) {
    console.error("[mail] completed receipt setup failed:", error)
    return { sent: false }
  }
}

export async function sendCustomerReviewRequest(
  bookingId: string,
): Promise<SendResult> {
  try {
    if (!(await isMailConfigured())) return { sent: false }
    const settings = await getSettings()
    if (!channelEnabled(settings, "reviewRequest")) return { sent: false }

    const booking = await loadBooking(bookingId)
    if (!booking?.customer.email) return { sent: false }
    if (booking.status !== "completed") return { sent: false }
    if (!booking.driverId) return { sent: false }

    const existing = await prisma.review.findUnique({
      where: { bookingId: booking.id },
      select: { id: true },
    })
    if (existing) return { sent: false }

    const reviewUrl = reviewBookingUrl(
      booking.referenceCode,
      booking.customer.email,
    )
    const subject = `How was your trip? — ${booking.referenceCode}`
    const text = [
      `Hi ${booking.customer.name},`,
      "",
      `Thanks for riding with ${companyName(settings)}.`,
      `We'd love your feedback on trip ${booking.referenceCode}.`,
      "",
      `Rate your driver and overall experience (about 1 minute):`,
      reviewUrl,
      "",
      `Reference: ${booking.referenceCode}`,
      `Email: ${booking.customer.email}`,
      "",
      supportLine(settings),
    ].join("\n")

    const html = wrapEmail({
      company: companyName(settings),
      eyebrow: "Review",
      tone: "default",
      preheader: `Rate trip ${booking.referenceCode}`,
      title: "How was your trip?",
      introHtml: `Hi ${escapeHtml(booking.customer.name)}, thanks for riding with <strong>${escapeHtml(companyName(settings))}</strong>. Please rate your driver and overall experience — it only takes a minute.`,
      rowsHtml:
        detailRow("Reference", booking.referenceCode) +
        detailRow("Route", `${booking.pickupAddress} → ${booking.dropoffAddress}`) +
        detailRow("When", formatWhen(booking.pickupDateTime)),
      cta: { href: reviewUrl, label: "Leave a review" },
      footer: supportLine(settings),
    })

    return logAndSend({
      to: booking.customer.email,
      subject,
      text,
      html,
      type: "review_request",
      bookingId: booking.id,
      customerId: booking.customerId,
      replyTo: safeReplyTo(settings),
    })
  } catch (error) {
    console.error("[mail] review request setup failed:", error)
    return { sent: false }
  }
}

/** Receipt + review request after a trip is marked completed. Never throws. */
export async function notifyBookingCompleted(bookingId: string): Promise<void> {
  try {
    await sendCustomerCompletedReceipt(bookingId)
  } catch {
    // never block
  }
  try {
    await sendCustomerReviewRequest(bookingId)
  } catch {
    // never block
  }
}

/** Ops alert when a customer submits a post-trip review (pending moderation). */
export async function sendAdminReviewSubmitted(
  reviewId: string,
): Promise<SendResult> {
  try {
    if (!(await isMailConfigured())) return { sent: false }
    const settings = await getSettings()
    const to = resolveAdminNotificationEmail(settings)
    if (!to) return { sent: false }

    const review = await prisma.review.findUnique({
      where: { id: reviewId },
      select: {
        id: true,
        driverRating: true,
        platformRating: true,
        driverComment: true,
        platformComment: true,
        status: true,
        booking: {
          select: {
            id: true,
            referenceCode: true,
            customerId: true,
            customer: {
              select: { name: true, email: true },
            },
          },
        },
        driver: {
          select: { name: true },
        },
      },
    })
    if (!review) return { sent: false }

    const { booking } = review
    const link = adminReviewsUrl("pending")
    const bookingLink = adminBookingUrl(booking.id)
    const subject = `New review — ${booking.referenceCode}`
    const text = [
      `New review for ${booking.referenceCode}`,
      "",
      `Customer: ${booking.customer.name} (${booking.customer.email})`,
      `Driver: ${review.driver.name}`,
      `Driver rating: ${review.driverRating}/5`,
      `Platform rating: ${review.platformRating}/5`,
      review.driverComment ? `Driver comment: ${review.driverComment}` : null,
      review.platformComment
        ? `Platform comment: ${review.platformComment}`
        : null,
      "",
      `Status: ${review.status} (awaiting moderation)`,
      `Moderate: ${link}`,
      `Booking: ${bookingLink}`,
    ]
      .filter(Boolean)
      .join("\n")

    const commentRows =
      (review.driverComment
        ? detailRow("Driver comment", review.driverComment)
        : "") +
      (review.platformComment
        ? detailRow("Platform comment", review.platformComment)
        : "")

    const html = wrapEmail({
      company: companyName(settings),
      eyebrow: "Ops alert",
      tone: "default",
      preheader: `New review ${booking.referenceCode}`,
      title: "New customer review",
      introHtml: `A customer left feedback for trip <strong>${escapeHtml(booking.referenceCode)}</strong>. Moderate it before it appears on the public site.`,
      rowsHtml:
        detailRow("Reference", booking.referenceCode) +
        detailRow(
          "Customer",
          `${booking.customer.name} · ${booking.customer.email}`,
        ) +
        detailRow("Driver", review.driver.name) +
        detailRow("Driver rating", `${review.driverRating} / 5`) +
        detailRow("Platform rating", `${review.platformRating} / 5`) +
        commentRows,
      cta: { href: link, label: "Moderate reviews" },
      footer: `Ops inbox · ${getAppBaseUrl()}`,
    })

    return logAndSend({
      to,
      subject,
      text,
      html,
      type: "review_submitted",
      bookingId: booking.id,
      customerId: booking.customerId,
    })
  } catch (error) {
    console.error("[mail] admin review submitted setup failed:", error)
    return { sent: false }
  }
}

export async function notifyReviewSubmitted(reviewId: string): Promise<void> {
  try {
    await sendAdminReviewSubmitted(reviewId)
  } catch {
    // never block
  }
}

export async function sendCustomerFlightDelay(
  bookingId: string,
  opts: { delayMinutes: number },
): Promise<SendResult> {
  try {
    if (!(await isMailConfigured())) return { sent: false }
    const settings = await getSettings()
    if (!channelEnabled(settings, "flightDelay")) return { sent: false }
    if (opts.delayMinutes < settings.flightDelayThresholdMinutes) {
      return { sent: false }
    }

    const booking = await loadBooking(bookingId)
    if (!booking?.customer.email) return { sent: false }

    const subject = `Flight delay — ${booking.referenceCode}`
    const text = [
      `Hi ${booking.customer.name},`,
      "",
      `We detected a delay of about ${opts.delayMinutes} minutes for flight ${booking.flightNumber || "your flight"}.`,
      `Your transfer ${booking.referenceCode} is still tracked — we adjust pickup when needed.`,
      `Scheduled pickup: ${formatWhen(booking.pickupDateTime)}`,
      "",
      `Manage: ${manageBookingUrl()}`,
      supportLine(settings),
    ].join("\n")

    const html = wrapEmail({
      company: companyName(settings),
      eyebrow: "Flight update",
      tone: "warning",
      preheader: `Flight delayed ~${opts.delayMinutes} min`,
      title: "Your flight appears delayed",
      introHtml: `Hi ${escapeHtml(booking.customer.name)}, we detected a delay of about <strong>${opts.delayMinutes} minutes</strong>${booking.flightNumber ? ` for flight <strong>${escapeHtml(booking.flightNumber)}</strong>` : ""}. We still track your transfer and adjust when needed.`,
      rowsHtml:
        detailRow("Delay", `${opts.delayMinutes} minutes`) +
        baseCustomerRows(booking),
      cta: { href: manageBookingUrl(), label: "Manage booking" },
      footer: supportLine(settings),
    })

    return logAndSend({
      to: booking.customer.email,
      subject,
      text,
      html,
      type: "flight_delay",
      bookingId: booking.id,
      customerId: booking.customerId,
      replyTo: safeReplyTo(settings),
    })
  } catch (error) {
    console.error("[mail] flight delay setup failed:", error)
    return { sent: false }
  }
}
