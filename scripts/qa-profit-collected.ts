/**
 * QA: staff-only Profit Collected (cash settlement from driver).
 *
 * Run: npm run test:profit-collected
 * Docker: docker compose -f docker-compose.dev.yml exec -T app npm run test:profit-collected
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
  console.log(`\nQA profit collected @ ${base}\n`)

  const required = [
    "prisma/migrations/20260830160000_booking_profit_collected/migration.sql",
    "app/api/admin/bookings/[id]/profit-collected/route.ts",
  ]
  let filesOk = true
  for (const file of required) {
    if (!existsSync(resolve(file))) {
      filesOk = false
      fail("A1 files", `missing ${file}`)
      break
    }
  }
  if (filesOk) pass("A1 profit-collected files present")

  const schema = read("prisma/schema.prisma")
  if (
    schema.includes("profitCollectedAt") &&
    schema.includes("profitCollectedById") &&
    schema.includes("profitCollectedAmount") &&
    schema.includes("BookingProfitCollectedBy")
  ) {
    pass("A2 schema fields")
  } else fail("A2 schema fields")

  const serializer = read("lib/bookings.ts")
  if (
    serializer.includes("profitCollected") &&
    serializer.includes("staffDriverCostFields") &&
    serializer.includes("profitCollectedBy")
  ) {
    pass("A3 serializer includes profitCollected")
  } else fail("A3 serializer includes profitCollected")

  const driverApi = read("app/api/driver/bookings/route.ts")
  const driverLeak =
    driverApi.includes("profitCollected") || driverApi.includes("driverCost")
  if (!driverLeak) pass("A4 driver bookings API omits profitCollected/driverCost")
  else fail("A4 driver bookings API leak", "profitCollected or driverCost")

  const uiList = read("components/bookings/bookings-view.tsx")
  const uiDetail = read("components/bookings/booking-detail.tsx")
  if (
    uiList.includes("profitCollected") &&
    uiList.includes("Collected") &&
    uiDetail.includes("ProfitCollectedSection") &&
    uiDetail.includes("Mark as Collected") &&
    uiDetail.includes("Confirm Profit Collection") &&
    uiDetail.includes("Undo Profit Collection?")
  ) {
    pass("A5 admin UI wiring")
  } else fail("A5 admin UI wiring")

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

  const qaOperatorEmail = "qa-profit-collected-operator@transfers.co"
  let operator = await prisma.adminUser.findUnique({
    where: { email: qaOperatorEmail },
  })
  if (!operator) {
    operator = await prisma.adminUser.create({
      data: {
        name: "QA Profit Collected Operator",
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

  const previous = {
    driverCost: booking.driverCost,
    driverCostUpdatedAt: booking.driverCostUpdatedAt,
    driverCostUpdatedById: booking.driverCostUpdatedById,
    profitCollectedAt: booking.profitCollectedAt,
    profitCollectedById: booking.profitCollectedById,
    profitCollectedAmount: booking.profitCollectedAmount,
    totalPrice: booking.totalPrice,
    status: booking.status,
  }

  await prisma.booking.update({
    where: { id: booking.id },
    data: {
      totalPrice: 100,
      status: "driver_accepted",
      driverCost: null,
      driverCostUpdatedAt: null,
      driverCostUpdatedById: null,
      profitCollectedAt: null,
      profitCollectedById: null,
      profitCollectedAmount: null,
    },
  })

  const adminToken = await signSessionToken(admin.id)
  const operatorToken = await signSessionToken(operator.id)
  const path = `/api/admin/bookings/${booking.id}/profit-collected`
  const costPath = `/api/admin/bookings/${booking.id}/driver-cost`

  try {
    const unauth = await api(path, {
      method: "PATCH",
      body: JSON.stringify({ collected: true }),
    })
    if (unauth.status === 401) pass("C4 unauthenticated PATCH → 401")
    else fail("C4 unauthenticated PATCH", `status ${unauth.status}`)

    const setCost = await api(costPath, {
      method: "PATCH",
      token: operatorToken,
      body: JSON.stringify({ driverCost: 30 }),
    })
    if (setCost.status === 200 && setCost.body?.booking?.driverCost === 30) {
      pass("C5 set driver cost for profit")
    } else {
      fail("C5 set driver cost", `${setCost.status}`)
    }

    const notCompleted = await api(path, {
      method: "PATCH",
      token: operatorToken,
      body: JSON.stringify({ collected: true }),
    })
    if (notCompleted.status === 400) {
      pass("C6 mark before completed → 400")
    } else fail("C6 mark before completed", `status ${notCompleted.status}`)

    await prisma.booking.update({
      where: { id: booking.id },
      data: { status: "completed", driverCost: null },
    })

    const noCost = await api(path, {
      method: "PATCH",
      token: operatorToken,
      body: JSON.stringify({ collected: true }),
    })
    if (noCost.status === 400) pass("C6b mark without driver cost → 400")
    else fail("C6b mark without cost", `status ${noCost.status}`)

    await api(costPath, {
      method: "PATCH",
      token: operatorToken,
      body: JSON.stringify({ driverCost: 30 }),
    })

    const expectedProfit = 70
    const detailBefore = await api(`/api/admin/bookings/${booking.id}`, {
      token: adminToken,
    })
    if (
      detailBefore.status === 200 &&
      detailBefore.body?.booking?.profit === expectedProfit &&
      detailBefore.body?.booking?.profitCollected === false
    ) {
      pass("C7 detail profit=70, not collected")
    } else {
      fail(
        "C7 detail profit",
        `profit=${detailBefore.body?.booking?.profit} collected=${detailBefore.body?.booking?.profitCollected}`,
      )
    }

    const list = await api("/api/admin/bookings?pageSize=50", {
      token: adminToken,
    })
    const listItem = list.body?.bookings?.find(
      (b: { id: string }) => b.id === booking.id,
    )
    if (
      list.status === 200 &&
      listItem?.profit === expectedProfit &&
      listItem?.profitCollected === false
    ) {
      pass("C8 list item includes profit, not collected")
    } else {
      fail(
        "C8 list item",
        `found=${Boolean(listItem)} profit=${listItem?.profit} collected=${listItem?.profitCollected}`,
      )
    }

    const opMark = await api(path, {
      method: "PATCH",
      token: operatorToken,
      body: JSON.stringify({ collected: true }),
    })
    if (
      opMark.status === 200 &&
      opMark.body?.booking?.profitCollected === true &&
      opMark.body?.booking?.profitCollectedBy?.id === operator.id &&
      typeof opMark.body?.booking?.profitCollectedAt === "string" &&
      opMark.body?.booking?.profitCollectedAmount === expectedProfit
    ) {
      pass("C9 operator mark freezes profitCollectedAmount=70")
    } else {
      fail(
        "C9 operator mark",
        `${opMark.status} amt=${opMark.body?.booking?.profitCollectedAmount}`,
      )
    }

    // Change live cost after collect — frozen amount must stay 70
    await api(costPath, {
      method: "PATCH",
      token: operatorToken,
      body: JSON.stringify({ driverCost: 40 }),
    })
    const afterCostChange = await api(`/api/admin/bookings/${booking.id}`, {
      token: adminToken,
    })
    if (
      afterCostChange.body?.booking?.profit === 60 &&
      afterCostChange.body?.booking?.profitCollectedAmount === 70 &&
      afterCostChange.body?.booking?.profitCollected === true
    ) {
      pass("C9b frozen amount survives driver-cost edit")
    } else {
      fail(
        "C9b frozen amount",
        `live=${afterCostChange.body?.booking?.profit} frozen=${afterCostChange.body?.booking?.profitCollectedAmount}`,
      )
    }

    const adminUndo = await api(path, {
      method: "PATCH",
      token: adminToken,
      body: JSON.stringify({ collected: false }),
    })
    if (
      adminUndo.status === 200 &&
      adminUndo.body?.booking?.profitCollected === false &&
      adminUndo.body?.booking?.profitCollectedAt == null &&
      adminUndo.body?.booking?.profitCollectedAmount == null
    ) {
      pass("C10 admin undo clears frozen amount")
    } else fail("C10 admin undo", `${adminUndo.status}`)

    // Restore cost to 30 for remake (still completed)
    await api(costPath, {
      method: "PATCH",
      token: operatorToken,
      body: JSON.stringify({ driverCost: 30 }),
    })

    const opMarkAgain = await api(path, {
      method: "PATCH",
      token: operatorToken,
      body: JSON.stringify({ collected: true }),
    })
    if (
      opMarkAgain.status === 200 &&
      opMarkAgain.body?.booking?.profitCollected &&
      opMarkAgain.body?.booking?.profitCollectedAmount === 70
    ) {
      pass("C11 remake collected")
    } else fail("C11 remake", `${opMarkAgain.status}`)

    const opUndo = await api(path, {
      method: "PATCH",
      token: operatorToken,
      body: JSON.stringify({ collected: false }),
    })
    if (opUndo.status === 403) pass("C12 operator undo → 403")
    else fail("C12 operator undo", `status ${opUndo.status}`)

    // Remains collected after operator undo attempt
    const stillCollected = await prisma.booking.findUnique({
      where: { id: booking.id },
      select: { profitCollectedAt: true },
    })
    if (stillCollected?.profitCollectedAt != null) {
      pass("C12b collection record unchanged after operator undo")
    } else fail("C12b collection cleared by operator")

    const adminUndoAfterOp = await api(path, {
      method: "PATCH",
      token: adminToken,
      body: JSON.stringify({ collected: false }),
    })
    if (
      adminUndoAfterOp.status === 200 &&
      adminUndoAfterOp.body?.booking?.profitCollected === false
    ) {
      pass("C12c admin can undo after operator mark")
    } else fail("C12c admin undo", `${adminUndoAfterOp.status}`)

    // Mark again then clear driver cost → collected must clear
    await api(path, {
      method: "PATCH",
      token: adminToken,
      body: JSON.stringify({ collected: true }),
    })
    const clearCost = await api(costPath, {
      method: "DELETE",
      token: adminToken,
    })
    if (
      clearCost.status === 200 &&
      clearCost.body?.booking?.driverCost == null &&
      clearCost.body?.booking?.profit == null &&
      clearCost.body?.booking?.profitCollected === false
    ) {
      pass("C13 clearing driver cost clears Profit Collected")
    } else {
      fail(
        "C13 clear cost clears collected",
        `collected=${clearCost.body?.booking?.profitCollected} cost=${clearCost.body?.booking?.driverCost}`,
      )
    }

    const badBody = await api(path, {
      method: "PATCH",
      token: adminToken,
      body: JSON.stringify({ collected: "yes" }),
    })
    if (badBody.status === 400) pass("C14 invalid payload → 400")
    else fail("C14 invalid payload", `status ${badBody.status}`)

    const conf = await api(
      `/api/bookings/confirmation/${encodeURIComponent(booking.referenceCode)}`,
    )
    if (conf.status === 200) {
      const raw = JSON.stringify(conf.body)
      if (!raw.includes("profitCollected") && !raw.includes("driverCost")) {
        pass("C15 confirmation omits profitCollected/driverCost")
      } else fail("C15 confirmation leak")
    } else {
      pass("C15 confirmation skip", `status ${conf.status}`)
    }
  } finally {
    await prisma.booking.update({
      where: { id: booking.id },
      data: {
        totalPrice: previous.totalPrice,
        status: previous.status,
        driverCost: previous.driverCost,
        driverCostUpdatedAt: previous.driverCostUpdatedAt,
        driverCostUpdatedById: previous.driverCostUpdatedById,
        profitCollectedAt: previous.profitCollectedAt,
        profitCollectedById: previous.profitCollectedById,
        profitCollectedAmount: previous.profitCollectedAmount,
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
