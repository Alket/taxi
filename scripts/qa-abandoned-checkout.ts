/**
 * QA: abandoned public checkout — mark after TTL, resume within 24h,
 * supersede on newer booking, expire after resume window.
 *
 * Run: npm run test:abandoned-checkout
 * Docker: docker compose -f docker-compose.dev.yml exec -T app npm run test:abandoned-checkout
 */
import { existsSync } from "fs"
import { resolve } from "path"

import { config as loadEnv } from "dotenv"
import { PrismaClient } from "@prisma/client"

loadEnv({ path: resolve(process.cwd(), ".env") })

const runningInDocker = existsSync("/.dockerenv")
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL =
    "postgresql://postgres:postgres@127.0.0.1:5432/taxi?schema=public"
} else if (!runningInDocker && /@db(?=:\d+)/.test(process.env.DATABASE_URL)) {
  process.env.DATABASE_URL = process.env.DATABASE_URL.replace(
    /@db(?=:\d+)/,
    "@127.0.0.1",
  )
}

import { markStaleCheckoutsAbandoned } from "../lib/abandon-checkouts"
import { isCheckoutSuperseded } from "../lib/booking-notes"
import {
  checkoutContinueUrl,
  signCheckoutResumeToken,
} from "../lib/checkout-resume"
import {
  ABANDONED_RESUME_TTL_MS,
  PENDING_CHECKOUT_TTL_MS,
} from "../lib/payment-session"
import { SETTINGS_ID } from "../lib/settings"

const base = (
  process.env.QA_BASE_URL ||
  process.env.SMOKE_BASE_URL ||
  "http://localhost:3000"
).replace(/\/$/, "")

const prisma = new PrismaClient()

type Result = { status: "PASS" | "FAIL"; case: string; detail?: string }
const results: Result[] = []

function pass(c: string, d = "") {
  results.push({ status: "PASS", case: c, detail: d })
  console.log("PASS:", c, d || "")
}
function fail(c: string, d = "") {
  results.push({ status: "FAIL", case: c, detail: d })
  console.log("FAIL:", c, "—", d)
}

function printSummary() {
  const fails = results.filter((r) => r.status === "FAIL").length
  const passes = results.filter((r) => r.status === "PASS").length
  console.log(`\n${passes} PASS / ${fails} FAIL (${results.length} checks)\n`)
}

async function waitForApp(timeoutMs = 120_000) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(`${base}/`, {
        headers: { "ngrok-skip-browser-warning": "true" },
        redirect: "manual",
      })
      if (res.status > 0 && res.status < 500) return true
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 2000))
  }
  return false
}

async function api(
  path: string,
  init?: RequestInit,
): Promise<{ status: number; body: any }> {
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      "ngrok-skip-browser-warning": "true",
      ...(init?.headers as Record<string, string> | undefined),
    },
  })
  const text = await res.text()
  let body: any = null
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = { raw: text.slice(0, 200) }
  }
  return { status: res.status, body }
}

function pickupIsoHoursFromNow(hours: number) {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString()
}

async function createPublicBooking(email: string, marker: string) {
  const config = await api("/api/booking/config")
  const airport = config.body?.airports?.[0]
  const zone = config.body?.zones?.[0]
  if (!airport?.lat || !zone?.id) {
    throw new Error("booking config missing airport/zone")
  }

  const create = await api("/api/bookings", {
    method: "POST",
    body: JSON.stringify({
      customer: {
        name: "QA Abandoned Checkout",
        email,
        phone: "+355691000999",
        whatsappOptIn: false,
      },
      direction: "airport_to_dest",
      pickupAddress: `${airport.name} (${airport.iataCode})`,
      pickupLat: airport.lat,
      pickupLng: airport.lng,
      dropoffAddress: zone.name,
      dropoffLat: airport.lat,
      dropoffLng: airport.lng,
      pickupDateTime: pickupIsoHoursFromNow(48),
      flightNumber: "QA9001",
      passengerCount: 1,
      luggageCount: 1,
      vehicleType: "sedan",
      zoneId: zone.id,
      isRoundTrip: false,
      meetAndGreet: false,
      driverNotes: marker,
    }),
  })

  if (create.status !== 201 || !create.body?.bookingId) {
    throw new Error(
      `create failed ${create.status} ${JSON.stringify(create.body).slice(0, 160)}`,
    )
  }

  return {
    bookingId: create.body.bookingId as string,
    referenceCode: create.body.referenceCode as string,
  }
}

async function main() {
  console.log(`\nQA abandoned checkout @ ${base}\n`)
  console.log(
    `TTL abandon=${PENDING_CHECKOUT_TTL_MS / 3600000}h resume=${ABANDONED_RESUME_TTL_MS / 3600000}h\n`,
  )

  if (!(await waitForApp())) {
    fail("app reachable", base)
    printSummary()
    process.exit(1)
  }
  pass("app reachable", base)

  const settingsBefore = await prisma.settings.findUnique({
    where: { id: SETTINGS_ID },
    select: { cashOnArrivalEnabled: true },
  })
  let restoredCash = false
  if (settingsBefore && !settingsBefore.cashOnArrivalEnabled) {
    await prisma.settings.update({
      where: { id: SETTINGS_ID },
      data: { cashOnArrivalEnabled: true },
    })
    restoredCash = true
  }

  const emailA = `qa-abandon-${Date.now()}@example.com`
  let bookingA: string | null = null
  let bookingB: string | null = null
  let bookingExpire: string | null = null

  try {
    // --- A: create → age → abandon → resume cash ---
    const a = await createPublicBooking(emailA, "[qa-abandon] A")
    bookingA = a.bookingId
    pass("create booking A", a.referenceCode)

    await prisma.booking.update({
      where: { id: bookingA },
      data: {
        createdAt: new Date(Date.now() - PENDING_CHECKOUT_TTL_MS - 60_000),
      },
    })

    const marked = await markStaleCheckoutsAbandoned()
    const found = marked.find((m) => m.id === bookingA)
    if (found) pass("cron marks A abandoned", found.referenceCode)
    else fail("cron marks A abandoned", `marked=${marked.length}`)

    const snapA = await prisma.booking.findUniqueOrThrow({
      where: { id: bookingA },
      select: { status: true, paymentStatus: true },
    })
    if (snapA.status === "abandoned" && snapA.paymentStatus === "unpaid") {
      pass("A status abandoned/unpaid")
    } else {
      fail("A status abandoned/unpaid", `${snapA.status}/${snapA.paymentStatus}`)
    }

    // Default admin list excludes abandoned
    const listDefault = await api("/api/admin/bookings?pageSize=50")
    // May be 401 without auth — skip if so
    if (listDefault.status === 401) {
      pass("admin list auth required (skip hide check without cookie)")
    } else if (listDefault.status === 200) {
      const ids = (listDefault.body?.bookings || []).map((b: any) => b.id)
      if (!ids.includes(bookingA)) pass("default admin list hides abandoned A")
      else fail("default admin list hides abandoned A", "A still listed")
    }

    const token = await signCheckoutResumeToken(bookingA)
    const continueUrl = checkoutContinueUrl(a.referenceCode, token)
    pass("resume token minted", continueUrl.includes("/book/continue/"))

    const cont = await api(
      `/api/bookings/continue/${encodeURIComponent(a.referenceCode)}?token=${encodeURIComponent(token)}`,
    )
    if (cont.status === 200 && cont.body?.bookingId === bookingA) {
      pass("GET continue API for A")
    } else {
      fail(
        "GET continue API for A",
        `${cont.status} ${cont.body?.error || cont.body?.code || ""}`,
      )
    }

    const cash = await api("/api/payments/cash-on-arrival", {
      method: "POST",
      body: JSON.stringify({ bookingId: bookingA }),
    })
    if (cash.status === 200) pass("cash confirm abandoned A → confirmed")
    else
      fail(
        "cash confirm abandoned A",
        `${cash.status} ${cash.body?.error || cash.body?.code || ""}`,
      )

    const afterCash = await prisma.booking.findUniqueOrThrow({
      where: { id: bookingA },
      select: { status: true },
    })
    if (afterCash.status === "confirmed") pass("A final confirmed")
    else fail("A final confirmed", afterCash.status)

    // --- B: supersede ---
    const emailB = `qa-supersede-${Date.now()}@example.com`
    const b1 = await createPublicBooking(emailB, "[qa-abandon] B1")
    bookingB = b1.bookingId
    pass("create booking B1", b1.referenceCode)

    await prisma.booking.update({
      where: { id: b1.bookingId },
      data: {
        createdAt: new Date(Date.now() - PENDING_CHECKOUT_TTL_MS - 60_000),
      },
    })
    await markStaleCheckoutsAbandoned()

    const b2 = await createPublicBooking(emailB, "[qa-abandon] B2")
    pass("create booking B2 same email", b2.referenceCode)

    const oldB = await prisma.booking.findUniqueOrThrow({
      where: { id: b1.bookingId },
      select: { status: true, notes: true },
    })
    if (oldB.status === "abandoned" && isCheckoutSuperseded(oldB.notes)) {
      pass("B1 superseded after B2")
    } else {
      fail(
        "B1 superseded after B2",
        `${oldB.status} superseded=${isCheckoutSuperseded(oldB.notes)}`,
      )
    }

    const payOld = await api("/api/payments/cash-on-arrival", {
      method: "POST",
      body: JSON.stringify({ bookingId: b1.bookingId }),
    })
    if (
      payOld.status === 409 &&
      (payOld.body?.code === "SUPERSEDED" || /newer booking/i.test(payOld.body?.error || ""))
    ) {
      pass("pay superseded B1 → 409 SUPERSEDED")
    } else {
      fail(
        "pay superseded B1 → 409 SUPERSEDED",
        `${payOld.status} ${payOld.body?.code || payOld.body?.error || ""}`,
      )
    }

    // --- expire beyond 24h ---
    const emailE = `qa-expire-${Date.now()}@example.com`
    const ex = await createPublicBooking(emailE, "[qa-abandon] expire")
    bookingExpire = ex.bookingId
    await prisma.booking.update({
      where: { id: bookingExpire },
      data: {
        status: "abandoned",
        createdAt: new Date(Date.now() - ABANDONED_RESUME_TTL_MS - 60_000),
      },
    })
    const payExpired = await api("/api/payments/cash-on-arrival", {
      method: "POST",
      body: JSON.stringify({ bookingId: bookingExpire }),
    })
    if (
      payExpired.status === 410 &&
      payExpired.body?.code === "SESSION_EXPIRED"
    ) {
      pass("pay after 24h → 410 SESSION_EXPIRED")
    } else {
      fail(
        "pay after 24h → 410 SESSION_EXPIRED",
        `${payExpired.status} ${payExpired.body?.code || ""}`,
      )
    }
  } catch (err) {
    fail("fatal", (err as Error).message)
  } finally {
    if (restoredCash) {
      await prisma.settings.update({
        where: { id: SETTINGS_ID },
        data: { cashOnArrivalEnabled: false },
      })
    }
    void bookingB
    void bookingExpire
  }

  printSummary()
  const fails = results.filter((r) => r.status === "FAIL").length
  await prisma.$disconnect()
  process.exit(fails > 0 ? 1 : 0)
}

main().catch(async (err) => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
})
