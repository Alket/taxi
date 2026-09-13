/**
 * QA: driver Cash Paid vs admin Payment staying Unpaid.
 *
 * Run: npm run test:cash-paid
 * Docker: docker compose -f docker-compose.dev.yml exec -T app npm run test:cash-paid
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
import {
  DRIVER_SESSION_COOKIE,
  signDriverSessionToken,
} from "../lib/driver-session"
import { cashToCollect } from "../lib/driver-cash"

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
  init: RequestInit & { token?: string; driverToken?: string } = {},
): Promise<{ status: number; body: any }> {
  const { token, driverToken, ...rest } = init
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "ngrok-skip-browser-warning": "true",
    ...(rest.headers as Record<string, string> | undefined),
  }
  const cookies: string[] = []
  if (token) cookies.push(`${SESSION_COOKIE}=${token}`)
  if (driverToken) cookies.push(`${DRIVER_SESSION_COOKIE}=${driverToken}`)
  if (cookies.length) headers.cookie = cookies.join("; ")

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
  console.log(`\nQA cash-paid / admin unpaid @ ${base}\n`)

  // --- Unit ---
  if (
    cashToCollect({
      totalPrice: 100,
      balanceDue: 100,
      depositPaid: 0,
      paymentStatus: "unpaid",
    }) === 100
  )
    pass("U1 unpaid → full fare due")
  else fail("U1 unpaid due")

  if (
    cashToCollect({
      totalPrice: 100,
      balanceDue: 70,
      depositPaid: 30,
      paymentStatus: "deposit_paid",
    }) === 70
  )
    pass("U2 deposit_paid → balance due")
  else fail("U2 deposit_paid due")

  if (
    cashToCollect({
      totalPrice: 100,
      balanceDue: 0,
      depositPaid: 100,
      paymentStatus: "fully_paid",
    }) === 0
  )
    pass("U3 fully_paid → 0 due")
  else fail("U3 fully_paid due")

  // --- Static ---
  const cashPaidSrc = read("app/api/driver/bookings/[id]/cash-paid/route.ts")
  if (
    cashPaidSrc.includes("inconsistentCharged") &&
    cashPaidSrc.includes('paymentStatus: "fully_paid"') &&
    cashPaidSrc.includes("cash:")
  )
    pass("S1 cash-paid repair + fully_paid + cash: externalId")
  else fail("S1 cash-paid markers")

  const adminStatusSrc = read("app/api/admin/bookings/[id]/status/route.ts")
  if (
    adminStatusSrc.includes("CASH_DUE") &&
    adminStatusSrc.includes("confirmUnpaidComplete") &&
    adminStatusSrc.includes("cashToCollect")
  )
    pass("S2 admin status gates Complete on cash due")
  else fail("S2 admin status cash gate")

  const detailSrc = read("components/bookings/booking-detail.tsx")
  if (
    detailSrc.includes("confirmUnpaidComplete") &&
    detailSrc.includes("Complete with unpaid cash?")
  )
    pass("S3 admin UI unpaid-complete confirm")
  else fail("S3 admin UI confirm dialog")

  const driverDash = read("components/driver/driver-dashboard-view.tsx")
  if (
    driverDash.includes("trips.toastCashPaidRepaired") &&
    driverDash.includes("trips.toastCashPaidAlready")
  )
    pass("S4 driver toast distinguishes repair / already")
  else fail("S4 driver toast keys")

  const en = read("messages/driver-en.json")
  if (
    en.includes("trips.toastCashPaidRepaired") &&
    en.includes("trips.toastCashPaidAlready")
  )
    pass("S5 EN strings present")
  else fail("S5 EN strings")

  if (!(await waitForApp())) {
    fail("app reachable", base)
    printSummary()
    process.exit(1)
  }
  pass("app reachable", base)

  const createdBookingIds: string[] = []
  let createdCustomerId: string | null = null
  let createdDriverId: string | null = null
  const QA_PLATE = "QA-CASH-PAY"

  try {
    const stale = await prisma.driver.findFirst({
      where: { plateNumber: QA_PLATE },
      select: { id: true },
    })
    if (stale) {
      await prisma.booking.deleteMany({ where: { driverId: stale.id } })
      await prisma.driver.delete({ where: { id: stale.id } })
    }
    await prisma.booking.deleteMany({
      where: { referenceCode: { startsWith: "QA-CP-" } },
    })
    await prisma.customer.deleteMany({
      where: { email: { startsWith: "qa-cash-paid@" } },
    })

    const pinDonor = await prisma.driver.findFirst({
      where: { pinHash: { not: null } },
      select: { pinHash: true },
    })
    if (!pinDonor?.pinHash) {
      fail("L0 driver pin fixture", "no pinHash to reuse")
      printSummary()
      process.exit(1)
    }

    const driver = await prisma.driver.create({
      data: {
        name: "QA Cash Paid Driver",
        phone: "+355600088801",
        whatsappNumber: "+355600088801",
        vehicleMake: "QA",
        vehicleModel: "Sedan",
        plateNumber: QA_PLATE,
        vehicleType: "sedan",
        languages: ["en"],
        vetted: true,
        active: true,
        pinHash: pinDonor.pinHash,
      },
    })
    createdDriverId = driver.id
    pass("L1 driver fixture", driver.name)

    const customer = await prisma.customer.create({
      data: {
        name: "QA Cash Paid Rider",
        email: `qa-cash-paid@${uniq("x").toLowerCase()}.test`,
        phone: "+355600088802",
      },
    })
    createdCustomerId = customer.id

    const admin = await prisma.adminUser.findFirst({
      where: { role: "admin", suspended: false },
    })
    if (!admin) {
      fail("L2 admin fixture", "none")
      printSummary()
      process.exit(1)
    }
    const adminToken = await signSessionToken(admin.id)
    const driverToken = await signDriverSessionToken(driver.id)
    pass("L2 admin + driver tokens")

    const freeCancel = new Date(Date.now() + 86400000)
    const pickup = new Date()
    pickup.setHours(14, 0, 0, 0)

    async function seedCashOnArrival(
      tag: string,
      status: "arrived" | "completed",
    ) {
      const referenceCode = `QA-CP-${tag}-${uniq("")}`
      const pickupPin = String(
        randomBytes(3).readUIntBE(0, 3) % 1_000_000,
      ).padStart(6, "0")
      const booking = await prisma.booking.create({
        data: {
          referenceCode,
          pickupPin,
          direction: "airport_to_dest",
          pickupAddress: "TIA Airport",
          dropoffAddress: "QA Cash Paid Route",
          pickupDateTime: pickup,
          flightNumber: "QA200",
          passengerCount: 2,
          luggageCount: 1,
          vehicleType: "sedan",
          totalPrice: 80,
          depositAmount: 80,
          depositPaid: 0,
          balanceDue: 80,
          isBalanceCharged: false,
          paymentStatus: "unpaid",
          status,
          currency: "EUR",
          freeCancellationUntil: freeCancel,
          customerId: customer.id,
          driverId: driver.id,
          statusEvents: {
            create: [{ status }],
          },
        },
      })
      createdBookingIds.push(booking.id)
      return booking
    }

    // C1 happy path
    const b1 = await seedCashOnArrival("HAPPY", "arrived")
    const cash1 = await api(`/api/driver/bookings/${b1.id}/cash-paid`, {
      method: "POST",
      driverToken,
    })
    if (
      cash1.status === 200 &&
      cash1.body?.ok === true &&
      cash1.body?.repaired === false &&
      cash1.body?.alreadyRecorded === false &&
      Number(cash1.body?.amount) === 80
    ) {
      pass("C1 cash-paid happy path", `amount=${cash1.body.amount}`)
    } else {
      fail(
        "C1 cash-paid happy",
        `${cash1.status} ${JSON.stringify(cash1.body).slice(0, 180)}`,
      )
    }

    const b1after = await prisma.booking.findUnique({
      where: { id: b1.id },
      include: { payments: true },
    })
    const cashPay = b1after?.payments.find((p) =>
      p.externalId?.startsWith(`cash:${b1.id}`),
    )
    if (
      b1after?.paymentStatus === "fully_paid" &&
      Number(b1after.balanceDue) === 0 &&
      b1after.isBalanceCharged &&
      cashPay &&
      Number(cashPay.amount) === 80
    ) {
      pass("C1b DB fully_paid + cash: Payment")
    } else {
      fail(
        "C1b DB state",
        `pay=${b1after?.paymentStatus} cashPay=${cashPay?.amount}`,
      )
    }

    const cash1b = await api(`/api/driver/bookings/${b1.id}/cash-paid`, {
      method: "POST",
      driverToken,
    })
    if (
      cash1b.status === 200 &&
      cash1b.body?.alreadyRecorded === true &&
      cash1b.body?.repaired === false
    ) {
      pass("C1c second tap alreadyRecorded")
    } else {
      fail("C1c second tap", JSON.stringify(cash1b.body).slice(0, 120))
    }

    // C2 repair path
    const b2 = await seedCashOnArrival("REPAIR", "arrived")
    await prisma.booking.update({
      where: { id: b2.id },
      data: {
        isBalanceCharged: true,
        balanceChargedAt: new Date(),
        balanceChargedBy: driver.name,
        paymentStatus: "unpaid",
        depositPaid: 0,
        balanceDue: 80,
      },
    })
    const cash2 = await api(`/api/driver/bookings/${b2.id}/cash-paid`, {
      method: "POST",
      driverToken,
    })
    const b2after = await prisma.booking.findUnique({ where: { id: b2.id } })
    if (
      cash2.status === 200 &&
      cash2.body?.repaired === true &&
      b2after?.paymentStatus === "fully_paid" &&
      Number(b2after.balanceDue) === 0
    ) {
      pass("C2 repair inconsistent isBalanceCharged + unpaid")
    } else {
      fail(
        "C2 repair",
        `${cash2.status} pay=${b2after?.paymentStatus} body=${JSON.stringify(cash2.body).slice(0, 120)}`,
      )
    }

    // C3 driver complete blocked
    const b3 = await seedCashOnArrival("BLOCK", "arrived")
    const completeBlocked = await api(`/api/driver/bookings/${b3.id}/status`, {
      method: "PATCH",
      driverToken,
      body: JSON.stringify({ status: "completed" }),
    })
    if (completeBlocked.status === 409) {
      pass("C3 driver Complete blocked while cash due")
    } else {
      fail("C3 driver Complete", `status ${completeBlocked.status}`)
    }

    // C4 admin complete blocked
    const b4 = await seedCashOnArrival("ADMIN", "arrived")
    const adminBlock = await api(`/api/admin/bookings/${b4.id}/status`, {
      method: "PATCH",
      token: adminToken,
      body: JSON.stringify({ status: "completed" }),
    })
    if (
      adminBlock.status === 409 &&
      adminBlock.body?.code === "CASH_DUE" &&
      Number(adminBlock.body?.cashDue) === 80
    ) {
      pass("C4 admin Complete → CASH_DUE without confirm")
    } else {
      fail(
        "C4 admin gate",
        `${adminBlock.status} ${JSON.stringify(adminBlock.body).slice(0, 160)}`,
      )
    }

    // C5 admin force complete leaves unpaid
    const adminForce = await api(`/api/admin/bookings/${b4.id}/status`, {
      method: "PATCH",
      token: adminToken,
      body: JSON.stringify({
        status: "completed",
        confirmUnpaidComplete: true,
      }),
    })
    const b4after = await prisma.booking.findUnique({ where: { id: b4.id } })
    if (
      adminForce.status === 200 &&
      b4after?.status === "completed" &&
      b4after.paymentStatus === "unpaid"
    ) {
      pass("C5 admin confirm completes trip; Payment stays unpaid")
    } else {
      fail(
        "C5 admin confirm",
        `${adminForce.status} status=${b4after?.status} pay=${b4after?.paymentStatus}`,
      )
    }

    const cashAfterForce = await api(`/api/driver/bookings/${b4.id}/cash-paid`, {
      method: "POST",
      driverToken,
    })
    const b4paid = await prisma.booking.findUnique({ where: { id: b4.id } })
    if (
      cashAfterForce.status === 200 &&
      b4paid?.paymentStatus === "fully_paid"
    ) {
      pass("C5b Cash Paid after admin unpaid-complete → fully_paid")
    } else {
      fail(
        "C5b cash after force",
        `${cashAfterForce.status} pay=${b4paid?.paymentStatus}`,
      )
    }

    const detail = await api(`/api/admin/bookings/${b4.id}`, {
      token: adminToken,
    })
    if (
      detail.status === 200 &&
      detail.body?.booking?.paymentStatus === "fully_paid"
    ) {
      pass("C6 admin detail paymentStatus fully_paid")
    } else {
      fail(
        "C6 admin detail",
        `${detail.status} ${detail.body?.booking?.paymentStatus}`,
      )
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
    if (createdDriverId) {
      await prisma.driver
        .delete({ where: { id: createdDriverId } })
        .catch(() => {})
    }
    if (createdCustomerId) {
      await prisma.customer
        .delete({ where: { id: createdCustomerId } })
        .catch(() => {})
    }
  }

  printSummary()
  const failed = results.filter((r) => r.status === "FAIL").length
  await prisma.$disconnect()
  process.exit(failed > 0 ? 1 : 0)
}

main().catch(async (err) => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
})
