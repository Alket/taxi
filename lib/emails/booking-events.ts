import type { NotificationType } from "@prisma/client"

import { prisma } from "@/lib/db"
import {
  getAppBaseUrl,
  isMailConfigured,
  sendMail,
} from "@/lib/mail"
import {
  getSettings,
  resolveAdminNotificationEmail,
} from "@/lib/settings"
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

async function loadBooking(bookingId: string): Promise<BookingEmailRow | null> {
  return prisma.booking.findUnique({
    where: { id: bookingId },
    select: bookingSelect,
  }) as Promise<BookingEmailRow | null>
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
  if (!isMailConfigured()) return { sent: false }

  const log = await prisma.notificationLog.create({
    data: {
      bookingId: input.bookingId ?? null,
      customerId: input.customerId ?? null,
      channel: "email",
      type: input.type,
      status: "pending",
      recipient: input.to,
      subject: input.subject,
      body: input.text,
    },
  })

  try {
    await sendMail({
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
      replyTo: input.replyTo,
    })
    await prisma.notificationLog.update({
      where: { id: log.id },
      data: { status: "sent", sentAt: new Date() },
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
    console.error(`[mail] ${input.type} failed:`, error)
    return { sent: false }
  }
}

function channelEnabled(
  settings: Settings,
  key: keyof NotificationChannels,
): boolean {
  return Boolean(settings.notificationChannelsEnabled[key])
}

function baseCustomerRows(booking: BookingEmailRow): string {
  return [
    detailRow("Reference", booking.referenceCode),
    detailRow("Pickup", booking.pickupAddress),
    detailRow("Drop-off", booking.dropoffAddress),
    detailRow("When", formatWhen(booking.pickupDateTime)),
    booking.flightNumber ? detailRow("Flight", booking.flightNumber) : "",
    detailRow("Vehicle", vehicleLabel(booking.vehicleType)),
    detailRow("Passengers", String(booking.passengerCount)),
  ].join("")
}

function priceRows(booking: BookingEmailRow): string {
  return [
    detailRow("Total", money(Number(booking.totalPrice), booking.currency)),
    detailRow("Paid", money(Number(booking.depositPaid), booking.currency)),
    detailRow("Balance due", money(Number(booking.balanceDue), booking.currency)),
  ].join("")
}

function adminCustomerRows(booking: BookingEmailRow): string {
  return [
    detailRow("Customer", booking.customer.name),
    detailRow("Email", booking.customer.email),
    detailRow("Phone", booking.customer.phone),
  ].join("")
}

/** @deprecated Prefer sendCustomerBookingConfirmation + sendAdminNewBooking */
export async function sendBookingConfirmationEmail(
  bookingId: string,
): Promise<SendResult> {
  const [customer, admin] = await Promise.all([
    sendCustomerBookingConfirmation(bookingId),
    sendAdminNewBooking(bookingId),
  ])
  return { sent: customer.sent || admin.sent }
}

export async function sendCustomerBookingConfirmation(
  bookingId: string,
): Promise<SendResult> {
  try {
    if (!isMailConfigured()) return { sent: false }
    const settings = await getSettings()
    if (!channelEnabled(settings, "confirmation")) return { sent: false }

    const booking = await loadBooking(bookingId)
    if (!booking?.customer.email) return { sent: false }

    const company = companyName(settings)
    const manageUrl = manageBookingUrl()
    const subject = `Booking confirmed — ${booking.referenceCode}`
    const text = [
      `Hi ${booking.customer.name},`,
      "",
      `Your transfer with ${company} is confirmed.`,
      "",
      `Reference: ${booking.referenceCode}`,
      `Pickup: ${booking.pickupAddress}`,
      `Drop-off: ${booking.dropoffAddress}`,
      `When: ${formatWhen(booking.pickupDateTime)}`,
      `Total: ${money(Number(booking.totalPrice), booking.currency)}`,
      `Paid: ${money(Number(booking.depositPaid), booking.currency)}`,
      `Balance due: ${money(Number(booking.balanceDue), booking.currency)}`,
      "",
      "Cancellation: Cancelling forfeits the deposit paid — it is not refunded. The remaining balance is never charged. If a driver fails to show or the service is not delivered, contact support for a full refund.",
      "",
      `Manage: ${manageUrl}`,
      supportLine(settings),
    ].join("\n")

    const html = wrapEmail({
      company,
      eyebrow: "Confirmed",
      tone: "success",
      preheader: `Booking ${booking.referenceCode} is confirmed`,
      title: "Your transfer is booked",
      introHtml: `Hi ${escapeHtml(booking.customer.name)}, thanks for choosing <strong>${escapeHtml(company)}</strong>. Your ride details are below.`,
      rowsHtml:
        baseCustomerRows(booking) +
        priceRows(booking) +
        detailRow(
          "Cancellation",
          "Cancelling forfeits the deposit (no refund). Unpaid balance is never charged.",
        ),
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
      replyTo: settings.supportEmail || undefined,
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
    if (!isMailConfigured()) return { sent: false }
    const settings = await getSettings()
    const to = resolveAdminNotificationEmail(settings)
    if (!to) return { sent: false }

    const booking = await loadBooking(bookingId)
    if (!booking) return { sent: false }

    const link = adminBookingUrl(booking.id)
    const subject = `New booking — ${booking.referenceCode}`
    const text = [
      `New booking ${booking.referenceCode}`,
      "",
      `Customer: ${booking.customer.name} (${booking.customer.email}, ${booking.customer.phone})`,
      `Pickup: ${booking.pickupAddress}`,
      `Drop-off: ${booking.dropoffAddress}`,
      `When: ${formatWhen(booking.pickupDateTime)}`,
      `Total: ${money(Number(booking.totalPrice), booking.currency)}`,
      "",
      `Open: ${link}`,
    ].join("\n")

    const html = wrapEmail({
      company: companyName(settings),
      eyebrow: "Ops alert",
      tone: "default",
      preheader: `New booking ${booking.referenceCode}`,
      title: "New booking received",
      introHtml: `A customer just confirmed a transfer. Review and assign a driver when ready.`,
      rowsHtml:
        adminCustomerRows(booking) +
        baseCustomerRows(booking) +
        priceRows(booking),
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
    if (!isMailConfigured()) return { sent: false }
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
      replyTo: settings.supportEmail || undefined,
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
    if (!isMailConfigured()) return { sent: false }
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
}

export async function sendCustomerDateChange(
  bookingId: string,
  previousPickup: Date,
): Promise<SendResult> {
  try {
    if (!isMailConfigured()) return { sent: false }
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
      replyTo: settings.supportEmail || undefined,
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
    if (!isMailConfigured()) return { sent: false }
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

export async function notifyBookingDateChanged(
  bookingId: string,
  previousPickup: Date,
): Promise<void> {
  await Promise.all([
    sendCustomerDateChange(bookingId, previousPickup),
    sendAdminDateChange(bookingId, previousPickup),
  ])
}

export async function sendCustomerDriverAssigned(
  bookingId: string,
): Promise<SendResult> {
  try {
    if (!isMailConfigured()) return { sent: false }
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
      booking.pickupPin ? `Meet pin: ${booking.pickupPin}` : null,
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
        baseCustomerRows(booking) +
        (booking.pickupPin ? detailRow("Meet pin", booking.pickupPin) : ""),
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
      replyTo: settings.supportEmail || undefined,
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
    if (!isMailConfigured()) return { sent: false }
    const settings = await getSettings()
    if (!channelEnabled(settings, "reminder")) return { sent: false }

    const booking = await loadBooking(bookingId)
    if (!booking?.customer.email) return { sent: false }

    const subject = `Pickup reminder — ${booking.referenceCode}`
    const text = [
      `Hi ${booking.customer.name},`,
      "",
      `Reminder: your transfer ${booking.referenceCode} is coming up.`,
      `When: ${formatWhen(booking.pickupDateTime)}`,
      `Pickup: ${booking.pickupAddress}`,
      `Drop-off: ${booking.dropoffAddress}`,
      booking.pickupPin ? `Meet pin: ${booking.pickupPin}` : null,
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
        (booking.pickupPin ? detailRow("Meet pin", booking.pickupPin) : "") +
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
      replyTo: settings.supportEmail || undefined,
    })
  } catch (error) {
    console.error("[mail] pickup reminder setup failed:", error)
    return { sent: false }
  }
}

export async function sendCustomerCompletedReceipt(
  bookingId: string,
): Promise<SendResult> {
  try {
    if (!isMailConfigured()) return { sent: false }
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
      `Total: ${money(Number(booking.totalPrice), booking.currency)}`,
      `Paid: ${money(Number(booking.depositPaid), booking.currency)}`,
      `Balance due: ${money(Number(booking.balanceDue), booking.currency)}`,
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
      replyTo: settings.supportEmail || undefined,
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
    if (!isMailConfigured()) return { sent: false }
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
      replyTo: settings.supportEmail || undefined,
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
    if (!isMailConfigured()) return { sent: false }
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
    if (!isMailConfigured()) return { sent: false }
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
      replyTo: settings.supportEmail || undefined,
    })
  } catch (error) {
    console.error("[mail] flight delay setup failed:", error)
    return { sent: false }
  }
}
