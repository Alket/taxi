/**
 * QA: admin New Booking under /admin/bookings.
 *
 * Covers the sheet → POST /api/admin/bookings path: Confirmed status,
 * unpaid vs markAsPaid, auth gate, and that public /book cannot spoof admin.
 *
 * Run: npm run test:admin-new-booking
 * Docker: docker compose -f docker-compose.dev.yml exec -T app npm run test:admin-new-booking
 */
import { randomBytes } from "crypto"
import { existsSync, readFileSync } from "fs"
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

import { SESSION_COOKIE, signSessionToken } from "../lib/session"

const base = (process.env.QA_BASE_URL || "http://localhost:3000").replace(
  /\/$/,
  "",
)
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
function read(rel: string) {
  return readFileSync(resolve(rel), "utf8")
}
function uniq(tag: string) {
  return `${tag}${Date.now().toString(36)}${randomBytes(2).toString("hex")}`
}
function pickupIsoHoursFromNow(hours: number) {
  return new Date(Date.now() + hours * 3600_000).toISOString()
}

async function waitForApp(timeoutMs = 90_000) {
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
  init: RequestInit & { token?: string } = {},
): Promise<{ status: number; body: any }> {
  const { token, ...rest } = init
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "ngrok-skip-browser-warning": "true",
    ...(rest.headers as Record<string, string> | undefined),
  }
  if (token) headers.cookie = `${SESSION_COOKIE}=${token}`

  const res = await fetch(`${base}${path}`, { ...rest, headers })
  const text = await res.text()
  let body: any = null
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = { raw: text.slice(0, 240) }
  }
  return { status: res.status, body }
}

async function main() {
  console.log(`\nQA admin New Booking @ ${base}\n`)

  const createdBookingIds: string[] = []
  const createdCustomerEmails: string[] = []

  try {
    // --- Static ---
    const sheet = read("components/bookings/new-booking-sheet.tsx")
    if (
      sheet.includes("New Booking") &&
      sheet.includes('"/api/admin/bookings"') &&
      sheet.includes("markAsPaid")
    ) {
      pass("S1 New Booking sheet → admin API + markAsPaid")
    } else {
      fail("S1 New Booking sheet wiring")
    }

    const bookingsView = read("components/bookings/bookings-view.tsx")
    if (bookingsView.includes("NewBookingSheet")) {
      pass("S2 bookings-view mounts NewBookingSheet")
    } else {
      fail("S2 bookings-view NewBookingSheet")
    }

    const createLib = read("lib/create-booking.ts")
    if (
      createLib.includes('input.source === "admin"') &&
      createLib.includes('"confirmed"') &&
      createLib.includes('"pending"') &&
      /initialStatus[\s\S]*admin[\s\S]*confirmed[\s\S]*pending/.test(createLib)
    ) {
      pass("S3 admin → confirmed / public → pending")
    } else {
      fail("S3 initialStatus admin/public split")
    }

    const adminRoute = read("app/api/admin/bookings/route.ts")
    if (
      adminRoute.includes("requireStaffSession") &&
      adminRoute.includes('source: "admin"')
    ) {
      pass("S4 admin POST forces source admin + staff auth")
    } else {
      fail("S4 admin POST route")
    }

    const publicRoute = read("app/api/bookings/route.ts")
    if (publicRoute.includes('source: "public"')) {
      pass("S5 public POST forces source public")
    } else {
      fail("S5 public POST route")
    }

    if (!(await waitForApp())) {
      fail("app reachable", base)
      printSummary()
      process.exit(1)
    }
    pass("app reachable", base)

    let admin = await prisma.adminUser.findFirst({
      where: { email: "ops@transfers.co" },
    })
    if (!admin) {
      admin = await prisma.adminUser.findFirst({
        where: { role: "admin", suspended: false },
      })
    }
    if (!admin) {
      fail("admin fixture", "none")
      printSummary()
      process.exit(1)
    }
    if (admin.requiresPasswordReset || admin.suspended) {
      admin = await prisma.adminUser.update({
        where: { id: admin.id },
        data: { requiresPasswordReset: false, suspended: false },
      })
    }
    const adminToken = await signSessionToken(admin.id)
    pass("C0 admin fixture", admin.email)

    const config = await api("/api/booking/config")
    const airport = config.body?.airports?.[0]
    const zone = config.body?.zones?.[0]
    if (config.status === 200 && airport?.lat != null && zone?.id) {
      pass("C1 booking config", zone.name)
    } else {
      fail("C1 booking config", `${config.status}`)
      printSummary()
      process.exit(1)
    }

    function basePayload(overrides: Record<string, unknown> = {}) {
      const tag = uniq("qa")
      const email = `qa-admin-nb-${tag}@example.com`.toLowerCase()
      createdCustomerEmails.push(email)
      return {
        customer: {
          name: "QA Admin New Booking",
          email,
          phone: "+355691112299",
          whatsappOptIn: false,
        },
        direction: "airport_to_dest" as const,
        pickupAddress: `${airport.name} (${airport.iataCode})`,
        pickupLat: airport.lat,
        pickupLng: airport.lng,
        dropoffAddress: zone.name,
        dropoffLat: airport.lat,
        dropoffLng: airport.lng,
        pickupDateTime: pickupIsoHoursFromNow(96),
        flightNumber: "QA9001",
        passengerCount: 2,
        luggageCount: 1,
        vehicleType: "sedan" as const,
        zoneId: zone.id,
        isRoundTrip: false,
        meetAndGreet: false,
        markAsPaid: false,
        ...overrides,
      }
    }

    // Auth gate
    const unauth = await api("/api/admin/bookings", {
      method: "POST",
      body: JSON.stringify(basePayload()),
    })
    if (unauth.status === 401 || unauth.status === 403) {
      pass("A1 unauthenticated create blocked", String(unauth.status))
    } else {
      fail("A1 unauthenticated create", `${unauth.status}`)
    }

    // Admin unpaid → Confirmed + unpaid
    const unpaidCreate = await api("/api/admin/bookings", {
      method: "POST",
      token: adminToken,
      body: JSON.stringify(basePayload({ markAsPaid: false })),
    })
    const unpaidId = unpaidCreate.body?.bookings?.[0]?.id as string | undefined
    const unpaidRef = unpaidCreate.body?.bookings?.[0]?.referenceCode as
      | string
      | undefined
    if (unpaidCreate.status === 200 && unpaidId && unpaidRef) {
      createdBookingIds.push(unpaidId)
      pass("A2 admin create unpaid", unpaidRef)
    } else {
      fail(
        "A2 admin create unpaid",
        `${unpaidCreate.status} ${JSON.stringify(unpaidCreate.body).slice(0, 180)}`,
      )
    }

    if (unpaidId) {
      const row = await prisma.booking.findUnique({
        where: { id: unpaidId },
        include: {
          statusEvents: { orderBy: { timestamp: "asc" } },
          payments: true,
        },
      })
      if (
        row?.status === "confirmed" &&
        row.paymentStatus === "unpaid" &&
        Number(row.depositPaid) === 0 &&
        row.payments.length === 0 &&
        row.statusEvents.some((e) => e.status === "confirmed")
      ) {
        pass("A3 unpaid → confirmed + unpaid payment", row.referenceCode)
      } else {
        fail(
          "A3 unpaid DB state",
          `status=${row?.status} pay=${row?.paymentStatus} events=${row?.statusEvents.map((e) => e.status).join(",")}`,
        )
      }

      const detail = await api(`/api/admin/bookings/${unpaidId}`, {
        token: adminToken,
      })
      const detailBooking = detail.body?.booking ?? detail.body
      if (
        detail.status === 200 &&
        detailBooking?.status === "confirmed" &&
        detailBooking?.paymentStatus === "unpaid"
      ) {
        pass("A4 admin detail shows Confirmed / Unpaid")
      } else {
        fail(
          "A4 admin detail",
          `${detail.status} status=${detailBooking?.status} pay=${detailBooking?.paymentStatus}`,
        )
      }
    }

    // Admin markAsPaid → Confirmed + fully_paid
    const paidCreate = await api("/api/admin/bookings", {
      method: "POST",
      token: adminToken,
      body: JSON.stringify(basePayload({ markAsPaid: true })),
    })
    const paidId = paidCreate.body?.bookings?.[0]?.id as string | undefined
    const paidRef = paidCreate.body?.bookings?.[0]?.referenceCode as
      | string
      | undefined
    if (paidCreate.status === 200 && paidId && paidRef) {
      createdBookingIds.push(paidId)
      pass("A5 admin create markAsPaid", paidRef)
    } else {
      fail(
        "A5 admin create markAsPaid",
        `${paidCreate.status} ${JSON.stringify(paidCreate.body).slice(0, 180)}`,
      )
    }

    if (paidId) {
      const row = await prisma.booking.findUnique({
        where: { id: paidId },
        include: { payments: true },
      })
      const manualPay = row?.payments.find(
        (p) => p.provider === "manual" && p.externalId?.startsWith("admin-create:"),
      )
      if (
        row?.status === "confirmed" &&
        row.paymentStatus === "fully_paid" &&
        Number(row.balanceDue) === 0 &&
        row.isBalanceCharged &&
        Number(row.depositPaid) === Number(row.totalPrice) &&
        manualPay &&
        Number(manualPay.amount) === Number(row.totalPrice)
      ) {
        pass("A6 markAsPaid → confirmed + fully_paid + Payment", paidRef!)
      } else {
        fail(
          "A6 markAsPaid DB state",
          `status=${row?.status} pay=${row?.paymentStatus} payments=${row?.payments.length}`,
        )
      }
    }

    // Round-trip admin create → both legs confirmed
    const rtCreate = await api("/api/admin/bookings", {
      method: "POST",
      token: adminToken,
      body: JSON.stringify(
        basePayload({
          isRoundTrip: true,
          returnDateTime: pickupIsoHoursFromNow(120),
          markAsPaid: false,
        }),
      ),
    })
    const rtBookings = (rtCreate.body?.bookings ?? []) as {
      id: string
      referenceCode: string
    }[]
    if (rtCreate.status === 200 && rtBookings.length === 2) {
      for (const b of rtBookings) createdBookingIds.push(b.id)
      pass(
        "A7 admin round-trip create",
        rtBookings.map((b) => b.referenceCode).join(", "),
      )
      const legs = await prisma.booking.findMany({
        where: { id: { in: rtBookings.map((b) => b.id) } },
        select: { status: true, isRoundTrip: true, roundTripId: true },
      })
      const allConfirmed = legs.every((l) => l.status === "confirmed")
      const sameRt =
        legs.length === 2 &&
        legs[0].roundTripId &&
        legs[0].roundTripId === legs[1].roundTripId
      if (allConfirmed && sameRt) {
        pass("A8 round-trip both legs confirmed")
      } else {
        fail(
          "A8 round-trip legs",
          legs.map((l) => l.status).join(","),
        )
      }
    } else {
      fail(
        "A7 admin round-trip create",
        `${rtCreate.status} count=${rtBookings.length} ${JSON.stringify(rtCreate.body).slice(0, 160)}`,
      )
    }

    // Public cannot spoof admin Confirmed / markAsPaid
    const publicPayload = basePayload({
      markAsPaid: true,
      source: "admin",
      driverNotes: "[qa-admin-new-booking] public spoof attempt",
    })
    const publicCreate = await api("/api/bookings", {
      method: "POST",
      body: JSON.stringify(publicPayload),
    })
    const publicId =
      (publicCreate.body?.bookingId as string | undefined) ??
      (publicCreate.body?.bookings?.[0]?.id as string | undefined)
    if (
      (publicCreate.status === 200 || publicCreate.status === 201) &&
      publicId
    ) {
      createdBookingIds.push(publicId)
      const row = await prisma.booking.findUnique({ where: { id: publicId } })
      if (
        row?.status === "pending" &&
        row.paymentStatus === "unpaid" &&
        Number(row.depositPaid) === 0
      ) {
        pass("P1 public spoof markAsPaid/source → still pending unpaid")
      } else {
        fail(
          "P1 public spoof blocked",
          `status=${row?.status} pay=${row?.paymentStatus}`,
        )
      }
    } else {
      fail(
        "P1 public create",
        `${publicCreate.status} ${JSON.stringify(publicCreate.body).slice(0, 180)}`,
      )
    }

    // List includes admin-created booking
    if (unpaidRef) {
      const list = await api(
        `/api/admin/bookings?search=${encodeURIComponent(unpaidRef)}&pageSize=10`,
        { token: adminToken },
      )
      const hit = (list.body?.bookings ?? []).find(
        (b: { referenceCode?: string }) => b.referenceCode === unpaidRef,
      )
      if (list.status === 200 && hit?.status === "confirmed") {
        pass("A9 list shows admin booking Confirmed", unpaidRef)
      } else {
        fail(
          "A9 list",
          `${list.status} hit=${hit?.status ?? "missing"}`,
        )
      }
    }
  } finally {
    if (createdBookingIds.length) {
      await prisma.payment.deleteMany({
        where: { bookingId: { in: createdBookingIds } },
      })
      await prisma.bookingStatusEvent.deleteMany({
        where: { bookingId: { in: createdBookingIds } },
      })
      await prisma.booking.deleteMany({
        where: { id: { in: createdBookingIds } },
      })
    }
    if (createdCustomerEmails.length) {
      await prisma.customer.deleteMany({
        where: { email: { in: createdCustomerEmails } },
      })
    }
    await prisma.$disconnect()
  }

  printSummary()
  const fails = results.filter((r) => r.status === "FAIL").length
  process.exit(fails > 0 ? 1 : 0)
}

main().catch(async (err) => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
})
