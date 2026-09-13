/**
 * QA: /admin/analytics "Today" with two different bookings.
 *
 * Seeds:
 *  A — pickup yesterday, paid today  → counts in Today payment trips
 *  B — pickup today, paid today      → counts in Today payment trips
 *  C — pickup today, paid yesterday  → does NOT count in Today payments
 *
 * Run: npm run test:admin-analytics-today
 * Docker: docker compose -f docker-compose.dev.yml exec -T app npm run test:admin-analytics-today
 */
import { randomBytes } from "crypto"
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
function uniq(tag: string) {
  return `${tag}${Date.now().toString(36)}${randomBytes(2).toString("hex")}`
}
function dateKey(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
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

function driverTripCount(report: any, driverId: string): number {
  const rows = report?.revenueByDriver ?? []
  const row = rows.find((r: any) => r.driverId === driverId)
  return Number(row?.tripCount ?? 0)
}

async function main() {
  console.log(`\nQA admin analytics Today (2 bookings) @ ${base}\n`)

  const QA_PLATE = "QA-AN-TODAY"
  const createdBookingIds: string[] = []
  let createdCustomerId: string | null = null
  let createdDriverId: string | null = null

  try {
    if (!(await waitForApp())) {
      fail("app reachable", base)
      printSummary()
      process.exit(1)
    }
    pass("app reachable", base)

    const admin = await prisma.adminUser.findFirst({
      where: { role: "admin", suspended: false },
    })
    if (!admin) {
      fail("admin fixture", "none")
      printSummary()
      process.exit(1)
    }
    if (admin.requiresPasswordReset) {
      await prisma.adminUser.update({
        where: { id: admin.id },
        data: { requiresPasswordReset: false },
      })
    }
    const token = await signSessionToken(admin.id)
    pass("admin fixture", admin.email)

    const stale = await prisma.driver.findFirst({
      where: { plateNumber: QA_PLATE },
      select: { id: true },
    })
    if (stale) {
      await prisma.payment.deleteMany({
        where: { booking: { driverId: stale.id } },
      })
      await prisma.bookingStatusEvent.deleteMany({
        where: { booking: { driverId: stale.id } },
      })
      await prisma.booking.deleteMany({ where: { driverId: stale.id } })
      await prisma.driver.delete({ where: { id: stale.id } })
    }
    await prisma.booking.deleteMany({
      where: { referenceCode: { startsWith: "QA-AN-" } },
    })
    await prisma.customer.deleteMany({
      where: { email: { startsWith: "qa-analytics-today@" } },
    })

    const driver = await prisma.driver.create({
      data: {
        name: "QA Analytics Today Driver",
        phone: "+355600077701",
        whatsappNumber: "+355600077701",
        vehicleMake: "QA",
        vehicleModel: "Sedan",
        plateNumber: QA_PLATE,
        vehicleType: "sedan",
        languages: ["en"],
        vetted: true,
        active: true,
      },
    })
    createdDriverId = driver.id
    pass("driver fixture", driver.name)

    const customer = await prisma.customer.create({
      data: {
        name: "QA Analytics Today Rider",
        email: `qa-analytics-today@${uniq("x").toLowerCase()}.test`,
        phone: "+355600077702",
      },
    })
    createdCustomerId = customer.id

    const zone = await prisma.zone.findFirst({
      where: { active: true },
      orderBy: { name: "asc" },
    })

    const today = new Date()
    const todayPaidAt = new Date(today)
    todayPaidAt.setHours(12, 30, 0, 0)

    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayPaidAt = new Date(yesterday)
    yesterdayPaidAt.setHours(15, 0, 0, 0)

    const pickupYesterday = new Date(yesterday)
    pickupYesterday.setHours(14, 0, 0, 0)
    const pickupToday = new Date(today)
    pickupToday.setHours(16, 0, 0, 0)

    const freeCancel = new Date(Date.now() + 86_400_000)
    const todayKey = dateKey(today)
    const yesterdayKey = dateKey(yesterday)

    async function seedBooking(input: {
      tag: string
      pickupDateTime: Date
      paidAt: Date
      amount: number
    }) {
      const referenceCode = `QA-AN-${input.tag}-${uniq("")}`
      const pickupPin = String(
        randomBytes(3).readUIntBE(0, 3) % 1_000_000,
      ).padStart(6, "0")
      const booking = await prisma.booking.create({
        data: {
          referenceCode,
          pickupPin,
          direction: "airport_to_dest",
          pickupAddress: "TIA Airport",
          dropoffAddress: `QA Analytics ${input.tag}`,
          pickupDateTime: input.pickupDateTime,
          flightNumber: "QA1001",
          passengerCount: 2,
          luggageCount: 1,
          vehicleType: "sedan",
          totalPrice: input.amount,
          depositAmount: input.amount,
          depositPaid: input.amount,
          balanceDue: 0,
          isBalanceCharged: true,
          balanceChargedAt: input.paidAt,
          balanceChargedBy: "qa-analytics-today",
          paymentStatus: "fully_paid",
          status: "completed",
          currency: "EUR",
          freeCancellationUntil: freeCancel,
          customerId: customer.id,
          driverId: driver.id,
          zoneId: zone?.id ?? undefined,
          notes: `QA analytics today · ${input.tag}`,
          statusEvents: {
            create: [
              { status: "confirmed", timestamp: input.paidAt },
              { status: "completed", timestamp: input.paidAt },
            ],
          },
          payments: {
            create: {
              type: "balance",
              amount: input.amount,
              currency: "EUR",
              status: "fully_paid",
              provider: "manual",
              externalId: `qa-an:${referenceCode}`,
              paidAt: input.paidAt,
            },
          },
        },
      })
      createdBookingIds.push(booking.id)
      return booking
    }

    const unauth = await api(
      `/api/admin/analytics?dateFrom=${todayKey}&dateTo=${todayKey}`,
    )
    if (unauth.status === 401 || unauth.status === 403) {
      pass("A0 analytics requires staff", String(unauth.status))
    } else {
      fail("A0 analytics auth", String(unauth.status))
    }

    const baseline = await api(
      `/api/admin/analytics?dateFrom=${todayKey}&dateTo=${todayKey}&driverId=${driver.id}`,
      { token },
    )
    if (baseline.status !== 200) {
      fail(
        "A1 baseline Today",
        `${baseline.status} ${JSON.stringify(baseline.body).slice(0, 200)}`,
      )
      printSummary()
      process.exit(1)
    }
    pass(
      "A1 baseline Today (empty QA driver)",
      `payments=${baseline.body?.summary?.paymentCount ?? 0} trips=${driverTripCount(baseline.body, driver.id)}`,
    )

    const bookingA = await seedBooking({
      tag: "YDAY-PICKUP",
      pickupDateTime: pickupYesterday,
      paidAt: todayPaidAt,
      amount: 55,
    })
    const bookingB = await seedBooking({
      tag: "TODAY-PICKUP",
      pickupDateTime: pickupToday,
      paidAt: todayPaidAt,
      amount: 70,
    })
    pass(
      "A2 seeded 2 bookings paid today",
      `${bookingA.referenceCode} + ${bookingB.referenceCode}`,
    )

    const bookingC = await seedBooking({
      tag: "PAID-YDAY",
      pickupDateTime: pickupToday,
      paidAt: yesterdayPaidAt,
      amount: 40,
    })
    pass(
      "A3 seeded booking paid yesterday (pickup today)",
      bookingC.referenceCode,
    )

    const after = await api(
      `/api/admin/analytics?dateFrom=${todayKey}&dateTo=${todayKey}&driverId=${driver.id}`,
      { token },
    )
    if (after.status !== 200) {
      fail("A4 Today after seed", String(after.status))
      printSummary()
      process.exit(1)
    }

    const paymentCount = Number(after.body?.summary?.paymentCount ?? -1)
    const trips = driverTripCount(after.body, driver.id)
    const completed = Number(after.body?.summary?.completedTripCount ?? -1)
    const totalCollected = Number(after.body?.summary?.totalCollected ?? -1)

    if (paymentCount === 2) {
      pass("A5 Today paymentCount === 2", "A+B only (C paid yesterday)")
    } else {
      fail("A5 Today paymentCount === 2", `got ${paymentCount}`)
    }

    if (trips === 2) {
      pass("A6 Today driver tripCount === 2", "two distinct bookings")
    } else {
      fail("A6 Today driver tripCount === 2", `got ${trips}`)
    }

    if (Math.abs(totalCollected - 125) < 0.01) {
      pass("A7 Today totalCollected === 125", "55+70, not +40")
    } else {
      fail("A7 Today totalCollected === 125", `got ${totalCollected}`)
    }

    if (completed === 2) {
      pass("A8 completedTripCount === 2", "pickup today: B+C")
    } else {
      fail("A8 completedTripCount === 2", `got ${completed}`)
    }

    const yReport = await api(
      `/api/admin/analytics?dateFrom=${yesterdayKey}&dateTo=${yesterdayKey}&driverId=${driver.id}`,
      { token },
    )
    const yPayments = Number(yReport.body?.summary?.paymentCount ?? -1)
    const yTrips = driverTripCount(yReport.body, driver.id)
    if (yReport.status === 200 && yPayments === 1 && yTrips === 1) {
      pass("A9 Yesterday counts only booking C", `payments=${yPayments}`)
    } else {
      fail(
        "A9 Yesterday counts only booking C",
        `status=${yReport.status} payments=${yPayments} trips=${yTrips}`,
      )
    }

    pass(
      "A10 takeaway",
      "Today trips = paidAt today (pickup yesterday can still count; paid yesterday does not)",
    )
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
    if (createdDriverId) {
      await prisma.driver.deleteMany({ where: { id: createdDriverId } })
    }
    if (createdCustomerId) {
      await prisma.customer.deleteMany({ where: { id: createdCustomerId } })
    }
    await prisma.$disconnect()
  }

  printSummary()
  process.exit(results.some((r) => r.status === "FAIL") ? 1 : 0)
}

main().catch(async (err) => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
})
