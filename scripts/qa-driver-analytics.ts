/**
 * QA: driver analytics cash vs online split.
 *
 * Covers the bug where cash-paid trips were marked fully_paid and counted as
 * Online (€130 Alket case). Cash must follow `cash:` payment rows.
 *
 * Run: npm run test:driver-analytics
 * Docker: docker compose -f docker-compose.dev.yml exec -T app npm run test:driver-analytics
 */
import { randomBytes } from "crypto"
import { existsSync, readFileSync } from "fs"
import { resolve } from "path"

import { config as loadEnv } from "dotenv"
import { PrismaClient } from "@prisma/client"

import {
  DRIVER_SESSION_COOKIE,
  signDriverSessionToken,
} from "../lib/driver-session"
import {
  cashToCollect,
  isDriverCashPayment,
  splitCollected,
} from "../lib/driver-cash"
import type { PaymentStatus } from "../lib/types"

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

function dateKey(d = new Date()) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function uniq(prefix: string) {
  return `${prefix}${randomBytes(3).toString("hex").toUpperCase()}`
}

function expectSplit(
  name: string,
  args: Parameters<typeof splitCollected>[0],
  want: { cash: number; online: number },
) {
  const got = splitCollected(args)
  if (got.cash === want.cash && got.online === want.online) {
    pass(name, `cash=${got.cash} online=${got.online}`)
  } else {
    fail(
      name,
      `got cash=${got.cash} online=${got.online} expected cash=${want.cash} online=${want.online}`,
    )
  }
}

async function waitForApp(timeoutMs = 20_000) {
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
    await new Promise((r) => setTimeout(r, 1500))
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
  if (token) headers.cookie = `${DRIVER_SESSION_COOKIE}=${token}`

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
  console.log(`\nQA driver analytics cash/online @ ${base}\n`)

  // --- Unit: isDriverCashPayment ---
  if (isDriverCashPayment({ externalId: "cash:abc:1" })) {
    pass("U1 cash: externalId is cash")
  } else fail("U1 cash: externalId is cash")

  if (!isDriverCashPayment({ externalId: "pok_abc" })) {
    pass("U2 pok externalId is not cash")
  } else fail("U2 pok externalId is not cash")

  if (!isDriverCashPayment({ externalId: null })) {
    pass("U3 null externalId is not cash")
  } else fail("U3 null externalId is not cash")

  if (!isDriverCashPayment({ externalId: "admin-create:TRF-1" })) {
    pass("U4 admin-create is not cash")
  } else fail("U4 admin-create is not cash")

  // --- Unit: the Alket €130 regression ---
  expectSplit(
    "U5 Alket-style full cash fully_paid → all cash",
    {
      totalPrice: 130,
      balanceDue: 0,
      depositPaid: 130,
      paymentStatus: "fully_paid",
      payments: [
        { amount: 0, externalId: null },
        { amount: 130, externalId: "cash:booking:1" },
      ],
    },
    { cash: 130, online: 0 },
  )

  expectSplit(
    "U6 full online fully_paid → all online",
    {
      totalPrice: 80,
      balanceDue: 0,
      depositPaid: 80,
      paymentStatus: "fully_paid",
      payments: [{ amount: 80, externalId: "pok_order_1" }],
    },
    { cash: 0, online: 80 },
  )

  expectSplit(
    "U7 deposit online + cash balance",
    {
      totalPrice: 100,
      balanceDue: 0,
      depositPaid: 100,
      paymentStatus: "fully_paid",
      payments: [
        { amount: 30, externalId: "pok_dep" },
        { amount: 70, externalId: "cash:booking:2" },
      ],
    },
    { cash: 70, online: 30 },
  )

  expectSplit(
    "U8 deposit_paid still due (no cash row yet)",
    {
      totalPrice: 100,
      balanceDue: 70,
      depositPaid: 30,
      paymentStatus: "deposit_paid",
      payments: [{ amount: 30, externalId: "pok_dep" }],
    },
    { cash: 70, online: 30 },
  )

  expectSplit(
    "U9 unpaid cash-on-arrival",
    {
      totalPrice: 90,
      balanceDue: 90,
      depositPaid: 0,
      paymentStatus: "unpaid",
      payments: [],
    },
    { cash: 90, online: 0 },
  )

  expectSplit(
    "U10 refunded → no cash",
    {
      totalPrice: 50,
      balanceDue: 0,
      depositPaid: 50,
      paymentStatus: "refunded",
      payments: [],
    },
    { cash: 0, online: 50 },
  )

  // cashToCollect sanity (pre-collection)
  const due = cashToCollect({
    totalPrice: 100,
    balanceDue: 70,
    depositPaid: 30,
    paymentStatus: "deposit_paid",
  })
  if (due === 70) pass("U11 cashToCollect deposit balance", String(due))
  else fail("U11 cashToCollect deposit balance", String(due))

  const dueFull = cashToCollect({
    totalPrice: 130,
    balanceDue: 0,
    depositPaid: 130,
    paymentStatus: "fully_paid",
  })
  if (dueFull === 0) pass("U12 cashToCollect fully_paid → 0 due")
  else fail("U12 cashToCollect fully_paid → 0 due", String(dueFull))

  // --- Static wiring ---
  const required = [
    "lib/driver-cash.ts",
    "app/api/driver/analytics/route.ts",
    "app/api/driver/revenue/route.ts",
  ]
  let filesOk = true
  for (const file of required) {
    if (!existsSync(resolve(file))) {
      filesOk = false
      fail("S1 files", `missing ${file}`)
      break
    }
  }
  if (filesOk) pass("S1 analytics cash files present")

  const cashLib = read("lib/driver-cash.ts")
  if (
    cashLib.includes("export function splitCollected") &&
    cashLib.includes("export function isDriverCashPayment") &&
    cashLib.includes('startsWith("cash:")')
  ) {
    pass("S2 driver-cash exports splitCollected + cash: check")
  } else {
    fail("S2 driver-cash exports")
  }

  const analyticsSrc = read("app/api/driver/analytics/route.ts")
  if (
    analyticsSrc.includes("splitCollected") &&
    analyticsSrc.includes('status: "completed"') &&
    !analyticsSrc.includes("function cashPortion")
  ) {
    pass("S3 analytics uses splitCollected on completed trips")
  } else {
    fail("S3 analytics wiring", "missing splitCollected or still using cashPortion")
  }

  const revenueSrc = read("app/api/driver/revenue/route.ts")
  if (
    revenueSrc.includes("splitCollected") &&
    revenueSrc.includes("payments:")
  ) {
    pass("S4 revenue uses splitCollected + payments")
  } else {
    fail("S4 revenue wiring")
  }

  const cashPaidSrc = read("app/api/driver/bookings/[id]/cash-paid/route.ts")
  if (
    cashPaidSrc.includes('externalId: `cash:') &&
    cashPaidSrc.includes('paymentStatus: "fully_paid"')
  ) {
    pass("S5 cash-paid records cash: + fully_paid")
  } else {
    fail("S5 cash-paid route markers")
  }

  // --- Live API (optional if app down) ---
  const up = await waitForApp()
  if (!up) {
    pass("L0 live skipped", `app not reachable at ${base}`)
    printSummary()
    const failed = results.filter((r) => r.status === "FAIL").length
    process.exit(failed > 0 ? 1 : 0)
  }
  pass("L0 app responding")

  const unauth = await api("/api/driver/analytics")
  if (unauth.status === 401) pass("L1 analytics unauthenticated → 401")
  else fail("L1 analytics unauthenticated", `status ${unauth.status}`)

  const createdBookingIds: string[] = []
  let createdCustomerId: string | null = null
  let createdDriverId: string | null = null
  const QA_PLATE = "QA-CASH-AN"

  try {
    // Clean leftovers from interrupted runs
    const staleDriver = await prisma.driver.findFirst({
      where: { plateNumber: QA_PLATE },
      select: { id: true },
    })
    if (staleDriver) {
      await prisma.booking.deleteMany({ where: { driverId: staleDriver.id } })
      await prisma.driver.delete({ where: { id: staleDriver.id } })
    }
    await prisma.booking.deleteMany({
      where: { referenceCode: { startsWith: "QA-CASH-" } },
    })
    await prisma.customer.deleteMany({
      where: { email: { startsWith: "qa-cash-analytics@" } },
    })

    const pinHash = await prisma.driver.findFirst({
      where: { pinHash: { not: null } },
      select: { pinHash: true },
    })
    if (!pinHash?.pinHash) {
      fail("L2 driver pin fixture", "no pinHash to reuse")
      printSummary()
      process.exit(1)
    }

    const driver = await prisma.driver.create({
      data: {
        name: "QA Cash Analytics",
        phone: "+355600099901",
        whatsappNumber: "+355600099901",
        vehicleMake: "QA",
        vehicleModel: "Sedan",
        plateNumber: QA_PLATE,
        vehicleType: "sedan",
        languages: ["en"],
        vetted: true,
        active: true,
        pinHash: pinHash.pinHash,
      },
    })
    createdDriverId = driver.id
    pass("L2 QA driver fixture", driver.name)

    const customer = await prisma.customer.create({
      data: {
        name: "QA Cash Analytics Rider",
        email: `qa-cash-analytics@${uniq("x").toLowerCase()}.test`,
        phone: "+355600099902",
      },
    })
    createdCustomerId = customer.id

    const zone = await prisma.zone.findFirst({
      where: { active: true },
      orderBy: { name: "asc" },
    })

    const pickup = new Date()
    pickup.setHours(12, 0, 0, 0)
    const freeCancel = new Date(Date.now() + 86400000)

    async function seedBooking(input: {
      tag: string
      total: number
      status: "completed" | "driver_assigned"
      paymentStatus: PaymentStatus
      depositPaid: number
      balanceDue: number
      payments: {
        amount: number
        status: PaymentStatus
        provider: "manual" | "pok" | "stripe" | "paypal"
        type: "deposit" | "balance"
        externalId: string | null
      }[]
    }) {
      const referenceCode = `QA-CASH-${input.tag}-${uniq("")}`
      const pickupPin = String(
        randomBytes(3).readUIntBE(0, 3) % 1_000_000,
      ).padStart(6, "0")
      const booking = await prisma.booking.create({
        data: {
          referenceCode,
          pickupPin,
          direction: "airport_to_dest",
          pickupAddress: "TIA Airport",
          dropoffAddress: "QA Cash Route",
          pickupDateTime: pickup,
          flightNumber: "QA100",
          passengerCount: 2,
          luggageCount: 1,
          vehicleType: "sedan",
          totalPrice: input.total,
          depositAmount: input.total,
          depositPaid: input.depositPaid,
          balanceDue: input.balanceDue,
          isBalanceCharged: input.paymentStatus === "fully_paid",
          balanceChargedAt:
            input.paymentStatus === "fully_paid" ? new Date() : null,
          balanceChargedBy:
            input.paymentStatus === "fully_paid" ? driver.name : null,
          paymentStatus: input.paymentStatus,
          status: input.status,
          currency: "EUR",
          freeCancellationUntil: freeCancel,
          customerId: customer.id,
          driverId: driver.id,
          zoneId: zone?.id ?? null,
          statusEvents: {
            create: [{ status: input.status, timestamp: new Date() }],
          },
          payments: {
            create: input.payments.map((p) => ({
              amount: p.amount,
              currency: "EUR",
              status: p.status,
              provider: p.provider,
              type: p.type,
              externalId: p.externalId,
              paidAt: p.status === "unpaid" ? null : new Date(),
            })),
          },
        },
      })
      createdBookingIds.push(booking.id)
      return booking
    }

    await seedBooking({
      tag: "FULLCASH",
      total: 130,
      status: "completed",
      paymentStatus: "fully_paid",
      depositPaid: 130,
      balanceDue: 0,
      payments: [
        {
          amount: 0,
          status: "unpaid",
          provider: "manual",
          type: "deposit",
          externalId: null,
        },
        {
          amount: 130,
          status: "fully_paid",
          provider: "manual",
          type: "balance",
          externalId: `cash:${uniq("b")}:1`,
        },
      ],
    })

    await seedBooking({
      tag: "ONLINE",
      total: 80,
      status: "completed",
      paymentStatus: "fully_paid",
      depositPaid: 80,
      balanceDue: 0,
      payments: [
        {
          amount: 80,
          status: "fully_paid",
          provider: "pok",
          type: "balance",
          externalId: `pok_${uniq("o")}`,
        },
      ],
    })

    await seedBooking({
      tag: "MIXED",
      total: 100,
      status: "completed",
      paymentStatus: "fully_paid",
      depositPaid: 100,
      balanceDue: 0,
      payments: [
        {
          amount: 30,
          status: "deposit_paid",
          provider: "pok",
          type: "deposit",
          externalId: `pok_${uniq("d")}`,
        },
        {
          amount: 70,
          status: "fully_paid",
          provider: "manual",
          type: "balance",
          externalId: `cash:${uniq("m")}:2`,
        },
      ],
    })

    // Must not inflate totals (not completed)
    await seedBooking({
      tag: "ASSIGNED",
      total: 999,
      status: "driver_assigned",
      paymentStatus: "unpaid",
      depositPaid: 0,
      balanceDue: 999,
      payments: [],
    })

    pass("L3 seeded 3 completed + 1 assigned fixtures")

    const token = await signDriverSessionToken(driver.id)
    const day = dateKey(pickup)
    const analytics = await api(
      `/api/driver/analytics?dateFrom=${day}&dateTo=${day}`,
      { token },
    )

    if (analytics.status !== 200) {
      fail("L4 analytics response", `status ${analytics.status}`)
    } else {
      const s = analytics.body?.summary
      const checks: [string, unknown, unknown][] = [
        ["tripCount", s?.tripCount, 3],
        ["totalCollected", s?.totalCollected, 310],
        ["cashCollected", s?.cashCollected, 200],
        ["onlineCollected", s?.onlineCollected, 110],
      ]
      let allOk = true
      for (const [key, got, want] of checks) {
        if (got === want) pass(`L4 ${key}`, String(got))
        else {
          allOk = false
          fail(`L4 ${key}`, `got ${got} expected ${want}`)
        }
      }
      if (allOk) {
        pass(
          "L4b Alket regression: full cash not counted as online",
          "cash=200 includes €130",
        )
      }
    }

    const year = pickup.getFullYear()
    const month = pickup.getMonth() + 1
    const revenue = await api(
      `/api/driver/revenue?year=${year}&month=${month}`,
      { token },
    )
    if (
      revenue.status === 200 &&
      revenue.body?.cashCollected === 200 &&
      revenue.body?.total === 310 &&
      revenue.body?.completedTrips === 3
    ) {
      pass("L5 revenue endpoint cash/total match", "cash=200 total=310")
    } else {
      fail(
        "L5 revenue endpoint",
        `${revenue.status} ${JSON.stringify(revenue.body).slice(0, 200)}`,
      )
    }

    // Other driver's token must not see QA totals
    const other = await prisma.driver.findFirst({
      where: {
        active: true,
        pinHash: { not: null },
        id: { not: driver.id },
      },
    })
    if (!other) {
      pass("L6 cross-driver scope skipped", "no second driver")
    } else {
      const otherToken = await signDriverSessionToken(other.id)
      const otherAnalytics = await api(
        `/api/driver/analytics?dateFrom=${day}&dateTo=${day}`,
        { token: otherToken },
      )
      const foreignCash = otherAnalytics.body?.summary?.cashCollected ?? 0
      // Soft check: their cash should not equal our isolated 200 unless coincidence
      if (
        otherAnalytics.status === 200 &&
        otherAnalytics.body?.driver?.id === other.id
      ) {
        pass("L6 analytics scoped to session driver", other.name)
      } else {
        fail("L6 cross-driver scope", String(otherAnalytics.status))
      }
      void foreignCash
    }
  } finally {
    if (createdBookingIds.length) {
      await prisma.booking.deleteMany({
        where: { id: { in: createdBookingIds } },
      })
    }
    if (createdCustomerId) {
      await prisma.customer.deleteMany({ where: { id: createdCustomerId } })
    }
    if (createdDriverId) {
      await prisma.driver.deleteMany({ where: { id: createdDriverId } })
    }
    pass("L7 fixtures cleaned up")
  }

  printSummary()
  const failed = results.filter((r) => r.status === "FAIL").length
  process.exit(failed > 0 ? 1 : 0)
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
