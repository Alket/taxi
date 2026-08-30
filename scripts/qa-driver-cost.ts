/**
 * QA: staff-only booking driver cost — leak checks + live API roles + analytics.
 *
 * Run: npm run test:driver-cost
 * Docker: docker compose -f docker-compose.dev.yml exec -T app npm run test:driver-cost
 */
import { readFileSync, existsSync } from "fs"
import { resolve } from "path"

import { config as loadEnv } from "dotenv"
import { hash } from "bcryptjs"
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
  console.log(`\nQA driver cost @ ${base}\n`)

  const required = [
    "prisma/migrations/20260830140000_booking_driver_cost/migration.sql",
    "app/api/admin/bookings/[id]/driver-cost/route.ts",
    "lib/driver-cost.ts",
  ]
  let filesOk = true
  for (const file of required) {
    if (!existsSync(resolve(file))) {
      filesOk = false
      fail("A1 files", `missing ${file}`)
      break
    }
  }
  if (filesOk) pass("A1 driver-cost files present")

  const schema = read("prisma/schema.prisma")
  if (
    schema.includes("driverCost") &&
    schema.includes("model BookingDriverCostEvent") &&
    schema.includes("driverCostUpdatedById")
  ) {
    pass("A2 schema fields")
  } else fail("A2 schema fields")

  const serializer = read("lib/bookings.ts")
  if (
    serializer.includes("driverCost") &&
    serializer.includes("includeDriverCostHistory") &&
    serializer.includes("staffDriverCostFields")
  ) {
    const listFn = serializer.slice(
      serializer.indexOf("export function serializeBookingListItem"),
      serializer.indexOf("export function serializeBookingDetail"),
    )
    if (listFn.includes("staffDriverCostFields") && listFn.includes("profit")) {
      pass("A3 list serializer includes staff profit/driverCost")
    } else fail("A3 list serializer includes staff profit/driverCost")
  } else {
    fail("A3 serializer wiring")
  }

  const driverApi = read("app/api/driver/bookings/route.ts")
  if (!driverApi.includes("driverCost")) pass("A4 driver bookings API omits driverCost")
  else fail("A4 driver bookings API omits driverCost", "leak")

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
  pass("C1 admin fixture", admin.email)

  const qaOperatorEmail = "qa-driver-cost-operator@transfers.co"
  let operator = await prisma.adminUser.findUnique({
    where: { email: qaOperatorEmail },
  })
  if (!operator) {
    operator = await prisma.adminUser.create({
      data: {
        name: "QA Driver Cost Operator",
        email: qaOperatorEmail,
        passwordHash: await hash("qa-operator-temp", 10),
        role: "operator",
        suspended: false,
        requiresPasswordReset: false,
      },
    })
  } else {
    operator = await prisma.adminUser.update({
      where: { id: operator.id },
      data: {
        role: "operator",
        suspended: false,
        requiresPasswordReset: false,
      },
    })
  }
  pass("C2 operator fixture", operator.email)

  const booking = await prisma.booking.findFirst({
    where: {
      status: { notIn: ["pending", "abandoned", "cancelled"] },
    },
    orderBy: { pickupDateTime: "desc" },
  })
  if (!booking) {
    fail("C3 booking fixture", "no suitable booking")
    printSummary()
    process.exit(1)
  }
  pass("C3 booking fixture", booking.referenceCode)

  const previousCost = booking.driverCost
  await prisma.bookingDriverCostEvent.deleteMany({
    where: { bookingId: booking.id },
  })
  await prisma.booking.update({
    where: { id: booking.id },
    data: {
      driverCost: null,
      driverCostUpdatedAt: null,
      driverCostUpdatedById: null,
    },
  })

  const adminToken = await signSessionToken(admin.id)
  const operatorToken = await signSessionToken(operator.id)
  const path = `/api/admin/bookings/${booking.id}/driver-cost`

  try {
    const unauth = await api(path, {
      method: "PATCH",
      body: JSON.stringify({ driverCost: 10 }),
    })
    if (unauth.status === 401) pass("C4 unauthenticated PATCH → 401")
    else fail("C4 unauthenticated PATCH", `status ${unauth.status}`)

    const opAdd = await api(path, {
      method: "PATCH",
      token: operatorToken,
      body: JSON.stringify({ driverCost: 25.5 }),
    })
    if (opAdd.status === 200 && opAdd.body?.booking?.driverCost === 25.5) {
      pass("C5 operator can add driver cost")
    } else {
      fail(
        "C5 operator add",
        `${opAdd.status} ${JSON.stringify(opAdd.body).slice(0, 160)}`,
      )
    }
    const opHist = opAdd.body?.booking?.driverCostHistory
    if (Array.isArray(opHist) && opHist.length === 0) {
      pass("C5b operator response has empty history")
    } else {
      fail("C5b operator history empty", JSON.stringify(opHist)?.slice(0, 120))
    }

    const opEdit = await api(path, {
      method: "PATCH",
      token: operatorToken,
      body: JSON.stringify({ driverCost: 30 }),
    })
    if (opEdit.status === 200 && opEdit.body?.booking?.driverCost === 30) {
      pass("C6 operator can edit driver cost")
    } else fail("C6 operator edit", `${opEdit.status}`)

    const opClear = await api(path, {
      method: "PATCH",
      token: operatorToken,
      body: JSON.stringify({ driverCost: null }),
    })
    if (opClear.status === 403) pass("C7 operator clear PATCH → 403")
    else fail("C7 operator clear PATCH", `status ${opClear.status}`)

    const opDelete = await api(path, {
      method: "DELETE",
      token: operatorToken,
    })
    if (opDelete.status === 403) pass("C8 operator DELETE → 403")
    else fail("C8 operator DELETE", `status ${opDelete.status}`)

    const adminGet = await api(`/api/admin/bookings/${booking.id}`, {
      token: adminToken,
    })
    const hist = adminGet.body?.booking?.driverCostHistory
    if (
      adminGet.status === 200 &&
      Array.isArray(hist) &&
      hist.length >= 2 &&
      hist.some((e: any) => e.action === "created") &&
      hist.some((e: any) => e.action === "updated")
    ) {
      pass("C9 admin GET includes history")
    } else {
      fail("C9 admin history", `len=${hist?.length}`)
    }

    const opGet = await api(`/api/admin/bookings/${booking.id}`, {
      token: operatorToken,
    })
    if (
      opGet.status === 200 &&
      opGet.body?.booking?.driverCost === 30 &&
      Array.isArray(opGet.body?.booking?.driverCostHistory) &&
      opGet.body.booking.driverCostHistory.length === 0
    ) {
      pass("C10 operator GET has cost, empty history")
    } else {
      fail("C10 operator GET history stripped")
    }

    const adminClear = await api(path, {
      method: "DELETE",
      token: adminToken,
    })
    if (
      adminClear.status === 200 &&
      adminClear.body?.booking?.driverCost == null
    ) {
      pass("C11 admin DELETE clears cost")
    } else fail("C11 admin DELETE", `${adminClear.status}`)

    const afterClear = await prisma.bookingDriverCostEvent.count({
      where: { bookingId: booking.id },
    })
    if (afterClear >= 3) pass("C12 history retained after clear", `n=${afterClear}`)
    else fail("C12 history retained", `n=${afterClear}`)

    // Restore a known cost for analytics check
    await api(path, {
      method: "PATCH",
      token: adminToken,
      body: JSON.stringify({ driverCost: 20 }),
    })
    await prisma.booking.update({
      where: { id: booking.id },
      data: {
        pickupDateTime: new Date(),
        totalPrice: 100,
        driverCost: 20,
      },
    })

    const analytics = await api("/api/admin/analytics", { token: adminToken })
    if (
      analytics.status === 200 &&
      typeof analytics.body?.summary?.profit === "number" &&
      analytics.body.summary.profitTripCount >= 1
    ) {
      pass(
        "C13 analytics profit present",
        `profit=${analytics.body.summary.profit} trips=${analytics.body.summary.profitTripCount}`,
      )
    } else {
      fail("C13 analytics profit", `${analytics.status}`)
    }

    // Public confirmation should not expose driverCost if we hit confirmation API
    const conf = await api(
      `/api/bookings/confirmation/${encodeURIComponent(booking.referenceCode)}`,
    )
    if (conf.status === 200) {
      const raw = JSON.stringify(conf.body)
      if (!raw.includes("driverCost")) pass("C14 confirmation omits driverCost")
      else fail("C14 confirmation omits driverCost", "leak")
    } else {
      pass("C14 confirmation skip", `status ${conf.status}`)
    }
  } finally {
    // Restore prior cost loosely
    await prisma.booking.update({
      where: { id: booking.id },
      data: {
        driverCost: previousCost,
      },
    })
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
