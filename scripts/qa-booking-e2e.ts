/**
 * QA: full cash booking ops flow —
 * public form → cash confirm → admin assign → driver accept → arrive →
 * cash collect → complete.
 *
 * Run on host:  npm run test:booking-e2e
 * Run in Docker: docker compose -f docker-compose.dev.yml exec -T app npm run test:booking-e2e
 *
 * Env:
 *   QA_BASE_URL / SMOKE_BASE_URL  (default http://localhost:3000)
 *   SMOKE_BOOKING_EMAIL           optional customer email
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

import { hashDriverPin } from "../lib/driver-auth"
import {
  DRIVER_SESSION_COOKIE,
  signDriverSessionToken,
} from "../lib/driver-session"
import { SESSION_COOKIE, signSessionToken } from "../lib/session"
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

type CookieKind = "admin" | "driver"

async function api(
  path: string,
  init: RequestInit & { token?: string; cookieKind?: CookieKind } = {},
): Promise<{ status: number; body: any; text: string }> {
  const { token, cookieKind = "admin", ...rest } = init
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "ngrok-skip-browser-warning": "true",
    ...(rest.headers as Record<string, string> | undefined),
  }
  if (token) {
    const name =
      cookieKind === "driver" ? DRIVER_SESSION_COOKIE : SESSION_COOKIE
    headers.cookie = `${name}=${token}`
  }

  const res = await fetch(`${base}${path}`, { ...rest, headers })
  const text = await res.text()
  let body: any = null
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = { raw: text.slice(0, 240) }
  }
  return { status: res.status, body, text }
}

function pickupIsoHoursFromNow(hours: number) {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString()
}

async function bookingSnapshot(id: string) {
  return prisma.booking.findUniqueOrThrow({
    where: { id },
    select: {
      id: true,
      referenceCode: true,
      status: true,
      paymentStatus: true,
      driverId: true,
      totalPrice: true,
      balanceDue: true,
      depositPaid: true,
      notes: true,
      pickupPin: true,
    },
  })
}

async function main() {
  console.log(`\nQA booking E2E (form → assign → cash → complete) @ ${base}\n`)

  if (!(await waitForApp())) {
    fail("app reachable", `timed out waiting for ${base}`)
    printSummary()
    process.exit(1)
  }
  pass("app reachable", base)

  const settingsBefore = await prisma.settings.findUnique({
    where: { id: SETTINGS_ID },
    select: { cashOnArrivalEnabled: true, supportEmail: true },
  })
  if (!settingsBefore) {
    fail("settings row", "missing — run db seed")
    printSummary()
    process.exit(1)
  }

  let restoredCash = false
  if (!settingsBefore.cashOnArrivalEnabled) {
    await prisma.settings.update({
      where: { id: SETTINGS_ID },
      data: { cashOnArrivalEnabled: true },
    })
    restoredCash = true
    pass("cashOnArrival enabled for run", "(will restore)")
  } else {
    pass("cashOnArrival already enabled")
  }

  const customerEmail = (
    process.env.SMOKE_BOOKING_EMAIL ||
    settingsBefore.supportEmail ||
    "qa-booking-e2e@example.com"
  )
    .trim()
    .toLowerCase()

  let bookingId: string | null = null
  let adminId: string | null = null
  let driverId: string | null = null
  let previousPinHash: string | null | undefined

  try {
    // ---------------------------------------------------------------------------
    // Fixtures: staff + driver (mint JWTs; ensure driver has pinHash)
    // ---------------------------------------------------------------------------
    let admin = await prisma.adminUser.findFirst({
      where: { email: "ops@transfers.co" },
    })
    if (!admin) {
      admin = await prisma.adminUser.findFirst({
        where: { role: "admin", suspended: false },
        orderBy: { createdAt: "asc" },
      })
    }
    if (!admin) {
      fail("admin fixture", "no admin user in DB")
      printSummary()
      process.exit(1)
    }
    if (admin.requiresPasswordReset || admin.suspended) {
      admin = await prisma.adminUser.update({
        where: { id: admin.id },
        data: { requiresPasswordReset: false, suspended: false },
      })
    }
    adminId = admin.id
    const adminToken = await signSessionToken(admin.id)
    pass("admin fixture", admin.email)

    let driver = await prisma.driver.findFirst({
      where: { active: true },
      orderBy: { name: "asc" },
    })
    if (!driver) {
      fail("driver fixture", "no active driver")
      printSummary()
      process.exit(1)
    }
    previousPinHash = driver.pinHash
    if (!driver.pinHash) {
      await prisma.driver.update({
        where: { id: driver.id },
        data: { pinHash: await hashDriverPin("1234") },
      })
    }
    driverId = driver.id
    const driverToken = await signDriverSessionToken(driver.id)
    pass("driver fixture", `${driver.name} (${driver.phone})`)

    // ---------------------------------------------------------------------------
    // 1) Public quote + create
    // ---------------------------------------------------------------------------
    console.log("\n— Public booking —")
    const config = await api("/api/booking/config")
    const airport = config.body?.airports?.[0]
    const zone = config.body?.zones?.[0]
    if (config.status === 200 && airport?.lat && zone?.id) {
      pass("GET /api/booking/config", zone.name)
    } else {
      fail("GET /api/booking/config", `${config.status}`)
      throw new Error("Cannot continue without booking config")
    }

    const quote = await api("/api/pricing/quote", {
      method: "POST",
      body: JSON.stringify({
        direction: "airport_to_dest",
        vehicleType: "sedan",
        zoneId: zone.id,
      }),
    })
    if (quote.status === 200 && Number(quote.body?.price) > 0) {
      pass("POST /api/pricing/quote", `€${quote.body.price}`)
    } else {
      fail("POST /api/pricing/quote", `${quote.status} ${quote.body?.error || ""}`)
      throw new Error("Quote failed")
    }

    // Far enough ahead to avoid DRIVER_BUSY with existing trips.
    const pickupDateTime = pickupIsoHoursFromNow(72)
    const create = await api("/api/bookings", {
      method: "POST",
      body: JSON.stringify({
        customer: {
          name: "QA Booking E2E",
          email: customerEmail,
          phone: "+355691112233",
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
        flightNumber: "QA2048",
        passengerCount: 2,
        luggageCount: 1,
        vehicleType: "sedan",
        zoneId: zone.id,
        isRoundTrip: false,
        meetAndGreet: true,
        driverNotes: "[qa-booking-e2e] full flow test",
      }),
    })

    bookingId = create.body?.bookingId ?? null
    const referenceCode: string | null = create.body?.referenceCode ?? null
    if (create.status === 201 && bookingId && referenceCode) {
      pass("POST /api/bookings", referenceCode)
    } else {
      fail(
        "POST /api/bookings",
        `${create.status} ${create.body?.error || JSON.stringify(create.body).slice(0, 160)}`,
      )
      throw new Error("Create booking failed")
    }

    let snap = await bookingSnapshot(bookingId)
    if (snap.status === "pending" && snap.paymentStatus === "unpaid") {
      pass("booking pending/unpaid", snap.status)
    } else {
      fail("booking pending/unpaid", `${snap.status}/${snap.paymentStatus}`)
    }

    // ---------------------------------------------------------------------------
    // 2) Cash on arrival confirm
    // ---------------------------------------------------------------------------
    console.log("\n— Cash confirm —")
    const cash = await api("/api/payments/cash-on-arrival", {
      method: "POST",
      body: JSON.stringify({ bookingId }),
    })
    if (cash.status === 200 && cash.body?.referenceCode === referenceCode) {
      pass("POST /api/payments/cash-on-arrival")
    } else {
      fail(
        "POST /api/payments/cash-on-arrival",
        `${cash.status} ${cash.body?.error || ""}`,
      )
      throw new Error("Cash confirm failed")
    }

    snap = await bookingSnapshot(bookingId)
    if (
      snap.status === "confirmed" &&
      snap.paymentStatus === "unpaid" &&
      (snap.notes || "").toLowerCase().includes("cash on arrival")
    ) {
      pass("confirmed + unpaid cash", `balanceDue=${snap.balanceDue}`)
    } else {
      fail(
        "confirmed + unpaid cash",
        `${snap.status}/${snap.paymentStatus} notes=${(snap.notes || "").slice(0, 80)}`,
      )
    }

    // ---------------------------------------------------------------------------
    // 3) Admin assign driver
    // ---------------------------------------------------------------------------
    console.log("\n— Admin assign —")
    const unauthAssign = await api(
      `/api/admin/bookings/${bookingId}/assign-driver`,
      {
        method: "PATCH",
        body: JSON.stringify({ driverId }),
      },
    )
    if (unauthAssign.status === 401) pass("assign without auth → 401")
    else fail("assign without auth → 401", `status ${unauthAssign.status}`)

    const assign = await api(`/api/admin/bookings/${bookingId}/assign-driver`, {
      method: "PATCH",
      token: adminToken,
      cookieKind: "admin",
      body: JSON.stringify({ driverId }),
    })
    if (assign.status === 200) {
      pass("PATCH assign-driver", driver?.name)
    } else {
      fail(
        "PATCH assign-driver",
        `${assign.status} ${assign.body?.error || assign.body?.code || ""}`,
      )
      throw new Error("Assign failed")
    }

    snap = await bookingSnapshot(bookingId)
    if (snap.status === "driver_assigned" && snap.driverId === driverId) {
      pass("status driver_assigned", snap.referenceCode)
    } else {
      fail(
        "status driver_assigned",
        `${snap.status} driverId=${snap.driverId}`,
      )
    }

    // ---------------------------------------------------------------------------
    // 4) Driver accept → arrive
    // ---------------------------------------------------------------------------
    console.log("\n— Driver trip —")
    const accept = await api(`/api/driver/bookings/${bookingId}/respond`, {
      method: "POST",
      token: driverToken,
      cookieKind: "driver",
      body: JSON.stringify({ action: "accept" }),
    })
    if (accept.status === 200) pass("POST respond accept")
    else
      fail(
        "POST respond accept",
        `${accept.status} ${accept.body?.error || ""}`,
      )

    snap = await bookingSnapshot(bookingId)
    if (snap.status === "driver_accepted") pass("status driver_accepted")
    else fail("status driver_accepted", snap.status)

    const arrive = await api(`/api/driver/bookings/${bookingId}/status`, {
      method: "PATCH",
      token: driverToken,
      cookieKind: "driver",
      body: JSON.stringify({ status: "arrived" }),
    })
    if (arrive.status === 200) pass("PATCH status arrived")
    else
      fail(
        "PATCH status arrived",
        `${arrive.status} ${arrive.body?.error || ""}`,
      )

    snap = await bookingSnapshot(bookingId)
    if (snap.status === "arrived") pass("status arrived")
    else fail("status arrived", snap.status)

    // Complete before cash must be rejected.
    const completeEarly = await api(`/api/driver/bookings/${bookingId}/status`, {
      method: "PATCH",
      token: driverToken,
      cookieKind: "driver",
      body: JSON.stringify({ status: "completed" }),
    })
    if (
      completeEarly.status === 409 &&
      /cash/i.test(completeEarly.body?.error || "")
    ) {
      pass("complete before cash → 409")
    } else {
      fail(
        "complete before cash → 409",
        `${completeEarly.status} ${completeEarly.body?.error || ""}`,
      )
    }

    // ---------------------------------------------------------------------------
    // 5) Collect cash → complete
    // ---------------------------------------------------------------------------
    console.log("\n— Cash collect + complete —")
    const cashPaid = await api(`/api/driver/bookings/${bookingId}/cash-paid`, {
      method: "POST",
      token: driverToken,
      cookieKind: "driver",
    })
    if (cashPaid.status === 200 && cashPaid.body?.ok === true) {
      pass(
        "POST cash-paid",
        cashPaid.body.alreadyRecorded
          ? "alreadyRecorded"
          : `amount=${cashPaid.body.amount}`,
      )
    } else {
      fail(
        "POST cash-paid",
        `${cashPaid.status} ${cashPaid.body?.error || ""}`,
      )
    }

    snap = await bookingSnapshot(bookingId)
    if (
      snap.paymentStatus === "fully_paid" &&
      Number(snap.balanceDue) === 0
    ) {
      pass("payment fully_paid", `depositPaid=${snap.depositPaid}`)
    } else {
      fail(
        "payment fully_paid",
        `${snap.paymentStatus} balanceDue=${snap.balanceDue}`,
      )
    }

    const complete = await api(`/api/driver/bookings/${bookingId}/status`, {
      method: "PATCH",
      token: driverToken,
      cookieKind: "driver",
      body: JSON.stringify({ status: "completed" }),
    })
    if (complete.status === 200) pass("PATCH status completed")
    else
      fail(
        "PATCH status completed",
        `${complete.status} ${complete.body?.error || ""}`,
      )

    snap = await bookingSnapshot(bookingId)
    if (snap.status === "completed" && snap.paymentStatus === "fully_paid") {
      pass(
        "final state completed/fully_paid",
        `${snap.referenceCode}`,
      )
    } else {
      fail(
        "final state completed/fully_paid",
        `${snap.status}/${snap.paymentStatus}`,
      )
    }

    // Admin detail should still load for the completed trip.
    const detail = await api(`/api/admin/bookings/${bookingId}`, {
      token: adminToken,
      cookieKind: "admin",
    })
    if (
      detail.status === 200 &&
      (detail.body?.status === "completed" ||
        detail.body?.booking?.status === "completed")
    ) {
      pass("GET admin booking detail completed")
    } else if (detail.status === 200) {
      // Some serializers nest under booking
      const status =
        detail.body?.status ?? detail.body?.booking?.status ?? "?"
      if (status === "completed") pass("GET admin booking detail completed")
      else fail("GET admin booking detail completed", `status=${status}`)
    } else {
      fail("GET admin booking detail completed", `HTTP ${detail.status}`)
    }
  } finally {
    if (restoredCash) {
      await prisma.settings.update({
        where: { id: SETTINGS_ID },
        data: { cashOnArrivalEnabled: false },
      })
      console.log("\nRestored cashOnArrivalEnabled=false")
    }

    // Restore driver pinHash if we invented one for the run.
    if (driverId && previousPinHash === null) {
      await prisma.driver.update({
        where: { id: driverId },
        data: { pinHash: null },
      })
    }

    void adminId
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
