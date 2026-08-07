/**
 * End-to-end smoke: quote → create booking → cash confirm → confirmation /
 * lookup → emails → cancel → cancellation emails.
 *
 * Requires a running app (default http://127.0.0.1:3000) and database.
 *
 *   npm run test:booking
 *   SMOKE_BASE_URL=http://127.0.0.1:3000 SMOKE_BOOKING_EMAIL=you@example.com npm run test:booking
 *
 * Uses cash-on-arrival (no real card). Temporarily enables cash if needed and
 * restores the previous setting. Creates a real booking then cancels it.
 */
import { prisma } from "@/lib/db"
import { SETTINGS_ID } from "@/lib/settings"

const BASE = (process.env.SMOKE_BASE_URL || "http://127.0.0.1:3000").replace(
  /\/$/,
  "",
)

let failures = 0

function check(name: string, ok: boolean, detail?: string) {
  if (ok) {
    console.log(`  ✓ ${name}${detail ? ` — ${detail}` : ""}`)
  } else {
    failures += 1
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`)
  }
}

async function jsonFetch(
  path: string,
  init?: RequestInit,
): Promise<{ status: number; body: any; text: string }> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers || {}),
    },
  })
  const text = await res.text()
  let body: any = null
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = { raw: text.slice(0, 200) }
  }
  return { status: res.status, body, text }
}

function pickupIsoHoursFromNow(hours: number) {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString()
}

async function waitForEmailLogs(
  bookingId: string,
  type: "confirmation" | "cancellation",
  minCount: number,
  timeoutMs = 20_000,
) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    const logs = await prisma.notificationLog.findMany({
      where: { bookingId, channel: "email", type },
      orderBy: { createdAt: "asc" },
    })
    if (logs.length >= minCount) return logs
    await new Promise((r) => setTimeout(r, 500))
  }
  return prisma.notificationLog.findMany({
    where: { bookingId, channel: "email", type },
    orderBy: { createdAt: "asc" },
  })
}

async function main() {
  console.log(`Booking flow smoke against ${BASE}\n`)

  const settingsBefore = await prisma.settings.findUnique({
    where: { id: SETTINGS_ID },
    select: {
      cashOnArrivalEnabled: true,
      supportEmail: true,
      smtpHost: true,
      smtpUser: true,
      smtpFrom: true,
    },
  })
  if (!settingsBefore) {
    throw new Error("Settings row missing — run db seed first.")
  }

  const customerEmail = (
    process.env.SMOKE_BOOKING_EMAIL ||
    settingsBefore.supportEmail ||
    process.env.SMTP_USER ||
    "smoke-booking@example.com"
  )
    .trim()
    .toLowerCase()

  let restoredCash = false
  if (!settingsBefore.cashOnArrivalEnabled) {
    await prisma.settings.update({
      where: { id: SETTINGS_ID },
      data: { cashOnArrivalEnabled: true },
    })
    restoredCash = true
    console.log("Enabled cashOnArrival for this run (will restore).\n")
  }

  let bookingId: string | null = null
  let referenceCode: string | null = null

  try {
    console.log("1) Config + quote")
    const config = await jsonFetch("/api/booking/config")
    check("GET /api/booking/config", config.status === 200)
    const airport = config.body?.airports?.[0]
    const zone = config.body?.zones?.[0]
    check("has airport", Boolean(airport?.lat && airport?.lng), airport?.name)
    check("has zone", Boolean(zone?.id), zone?.name)

    const publicSettings = await jsonFetch("/api/settings/public")
    check(
      "cash on arrival enabled",
      publicSettings.body?.cashOnArrivalEnabled === true,
    )

    const quote = await jsonFetch("/api/pricing/quote", {
      method: "POST",
      body: JSON.stringify({
        direction: "airport_to_dest",
        vehicleType: "sedan",
        zoneId: zone.id,
      }),
    })
    check(
      "POST /api/pricing/quote",
      quote.status === 200 && Number(quote.body?.price) > 0,
      quote.status === 200
        ? `€${quote.body.price} → ${quote.body.zoneName}`
        : `${quote.status} ${quote.body?.error || quote.body?.code || ""}`,
    )

    console.log("\n2) Create booking (step 1→2)")
    const pickupDateTime = pickupIsoHoursFromNow(3)
    const create = await jsonFetch("/api/bookings", {
      method: "POST",
      body: JSON.stringify({
        customer: {
          name: "Smoke Booking Tester",
          email: customerEmail,
          phone: "+355691234567",
          whatsappOptIn: false,
        },
        direction: "airport_to_dest",
        pickupAddress: `${airport.name} (${airport.iataCode})`,
        pickupLat: airport.lat,
        pickupLng: airport.lng,
        dropoffAddress: zone.name,
        dropoffLat: airport.lat,
        dropoffLng: airport.lng,
        pickupDateTime,
        flightNumber: "SM1234",
        passengerCount: 2,
        luggageCount: 2,
        vehicleType: "sedan",
        zoneId: zone.id,
        isRoundTrip: false,
        meetAndGreet: true,
        driverNotes: "[smoke-booking-flow] auto test — safe to cancel",
      }),
    })

    bookingId = create.body?.bookingId ?? null
    referenceCode = create.body?.referenceCode ?? null
    check(
      "POST /api/bookings",
      create.status === 201 && Boolean(bookingId && referenceCode),
      create.status === 201
        ? `${referenceCode}`
        : `${create.status} ${create.body?.error || JSON.stringify(create.body).slice(0, 160)}`,
    )
    check(
      "referenceCode format",
      Boolean(referenceCode && /^TRF-[A-F0-9]{6}$/i.test(referenceCode)),
      referenceCode || undefined,
    )

    if (!bookingId || !referenceCode) {
      throw new Error("Cannot continue without bookingId/referenceCode")
    }

    const pending = await prisma.booking.findUniqueOrThrow({
      where: { id: bookingId },
      select: {
        status: true,
        paymentStatus: true,
        pickupPin: true,
        totalPrice: true,
        depositAmount: true,
      },
    })
    check("booking status pending", pending.status === "pending", pending.status)
    check(
      "booking payment unpaid",
      pending.paymentStatus === "unpaid",
      pending.paymentStatus,
    )
    check(
      "pickupPin is 6 digits",
      /^\d{6}$/.test(pending.pickupPin),
      pending.pickupPin,
    )

    console.log("\n3) Cash confirm (last payment step)")
    const cash = await jsonFetch("/api/payments/cash-on-arrival", {
      method: "POST",
      body: JSON.stringify({ bookingId }),
    })
    check(
      "POST /api/payments/cash-on-arrival",
      cash.status === 200 && cash.body?.referenceCode === referenceCode,
      cash.status === 200
        ? `confirmed=${!cash.body?.alreadyConfirmed}`
        : `${cash.status} ${cash.body?.error || cash.body?.code || ""}`,
    )

    const confirmed = await prisma.booking.findUniqueOrThrow({
      where: { id: bookingId },
      select: { status: true, paymentStatus: true, notes: true, balanceDue: true },
    })
    check("status confirmed", confirmed.status === "confirmed", confirmed.status)
    check(
      "payment still unpaid (cash)",
      confirmed.paymentStatus === "unpaid",
      confirmed.paymentStatus,
    )
    check(
      "notes mention cash on arrival",
      (confirmed.notes || "").toLowerCase().includes("cash on arrival"),
    )
    check(
      "balance due equals trip total",
      Number(confirmed.balanceDue) === Number(pending.totalPrice),
      `balance=${confirmed.balanceDue} total=${pending.totalPrice}`,
    )

    console.log("\n4) Confirmation + lookup")
    const confApi = await jsonFetch(
      `/api/bookings/confirmation/${encodeURIComponent(referenceCode)}`,
    )
    check(
      "GET confirmation API",
      confApi.status === 200 && confApi.body?.status === "confirmed",
      confApi.body?.status,
    )

    const confPage = await fetch(
      `${BASE}/book/confirmation/${encodeURIComponent(referenceCode)}`,
    )
    const confHtml = await confPage.text()
    check("GET confirmation page", confPage.status === 200)
    check(
      "confirmation page shows booking confirmed / reserved",
      /Booking confirmed|Trip reserved|Deposit received|confirm\.title/i.test(
        confHtml,
      ) || confHtml.includes(referenceCode),
      `status=${confPage.status} len=${confHtml.length}`,
    )

    const lookup = await jsonFetch(
      `/api/bookings/lookup?reference=${encodeURIComponent(referenceCode)}&email=${encodeURIComponent(customerEmail)}`,
    )
    check(
      "GET lookup by reference+email",
      lookup.status === 200 &&
        (lookup.body?.referenceCode === referenceCode ||
          lookup.body?.booking?.referenceCode === referenceCode ||
          lookup.body?.id === bookingId),
      lookup.status === 200
        ? "found"
        : `${lookup.status} ${lookup.body?.error || ""}`,
    )

    console.log("\n5) Confirmation emails")
    const smtpReady = Boolean(
      settingsBefore.smtpHost?.trim() && settingsBefore.smtpUser?.trim(),
    )
    check(
      "SMTP configured (DB or will use env via app)",
      smtpReady || Boolean(process.env.SMTP_HOST && process.env.SMTP_USER),
      smtpReady ? `host=${settingsBefore.smtpHost}` : "env fallback",
    )

    const confirmLogs = await waitForEmailLogs(bookingId, "confirmation", 1)
    check(
      "confirmation NotificationLog created",
      confirmLogs.length >= 1,
      `count=${confirmLogs.length}`,
    )

    const customerConfirm = confirmLogs.find(
      (log) => log.recipient.toLowerCase() === customerEmail,
    )
    // Admin notify may share the support inbox with the smoke customer email.
    const distinctRecipients = new Set(
      confirmLogs.map((log) => log.recipient.toLowerCase()),
    )
    check(
      "customer confirmation email logged",
      Boolean(customerConfirm),
      customerConfirm
        ? `${customerConfirm.status} → ${customerConfirm.recipient}`
        : `expected ${customerEmail}`,
    )
    check(
      "customer + admin confirmation emails logged",
      confirmLogs.length >= 2,
      `logs=${confirmLogs.length}, recipients=${[...distinctRecipients].join(", ")}`,
    )

    const sentConfirm = confirmLogs.filter((log) => log.status === "sent")
    const failedConfirm = confirmLogs.filter((log) => log.status === "failed")
    check(
      "at least one confirmation email sent via SMTP",
      sentConfirm.length >= 1,
      sentConfirm.length
        ? sentConfirm
            .map((l) => `${l.recipient} (${l.errorMessage || "ok"})`)
            .join("; ")
        : failedConfirm
            .map((l) => `${l.recipient}: ${l.errorMessage || "failed"}`)
            .join("; ") || "no sent logs",
    )

    if (customerConfirm?.subject) {
      check(
        "customer email subject includes reference",
        customerConfirm.subject.includes(referenceCode),
        customerConfirm.subject,
      )
    }
    if (customerConfirm?.body) {
      check(
        "customer email body includes PIN",
        customerConfirm.body.includes(pending.pickupPin),
      )
    }

    console.log("\n6) Cancel + cancellation emails")
    const cancel = await jsonFetch(`/api/bookings/${bookingId}/cancel`, {
      method: "PATCH",
      body: JSON.stringify({
        email: customerEmail,
        reference: referenceCode,
      }),
    })
    check(
      "PATCH cancel booking",
      cancel.status === 200,
      cancel.status === 200
        ? "cancelled"
        : `${cancel.status} ${cancel.body?.error || ""}`,
    )

    const afterCancel = await prisma.booking.findUniqueOrThrow({
      where: { id: bookingId },
      select: { status: true },
    })
    check(
      "booking status cancelled",
      afterCancel.status === "cancelled",
      afterCancel.status,
    )

    const cancelLogs = await waitForEmailLogs(bookingId, "cancellation", 1)
    check(
      "cancellation NotificationLog created",
      cancelLogs.length >= 1,
      `count=${cancelLogs.length}`,
    )
    const sentCancel = cancelLogs.filter((log) => log.status === "sent")
    check(
      "at least one cancellation email sent via SMTP",
      sentCancel.length >= 1,
      sentCancel.length
        ? sentCancel.map((l) => l.recipient).join(", ")
        : cancelLogs
            .map((l) => `${l.status}:${l.recipient}:${l.errorMessage || ""}`)
            .join("; ") || "none",
    )

    console.log("\nSummary")
    console.log(`  bookingId:      ${bookingId}`)
    console.log(`  referenceCode:  ${referenceCode}`)
    console.log(`  customerEmail:  ${customerEmail}`)
    console.log(`  confirm emails: ${confirmLogs.length} logged / ${sentConfirm.length} sent`)
    console.log(`  cancel emails:  ${cancelLogs.length} logged / ${sentCancel.length} sent`)
  } finally {
    if (restoredCash) {
      await prisma.settings.update({
        where: { id: SETTINGS_ID },
        data: {
          cashOnArrivalEnabled: settingsBefore.cashOnArrivalEnabled,
        },
      })
      console.log("\nRestored cashOnArrivalEnabled setting.")
    }
    await prisma.$disconnect()
  }

  if (failures > 0) {
    console.error(`\n${failures} check(s) failed`)
    process.exit(1)
  }
  console.log("\nAll booking-flow smoke checks passed.")
}

main().catch(async (error) => {
  console.error("\nSmoke run crashed:", error)
  await prisma.$disconnect().catch(() => {})
  process.exit(1)
})
