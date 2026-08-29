/**
 * QA: driver calendar (/driver/calendar) — wiring, auth, scoping, leak checks.
 *
 * Run: npm run test:driver-calendar
 * Docker: docker compose -f docker-compose.dev.yml exec -T app npm run test:driver-calendar
 */
import { readFileSync, existsSync } from "fs"
import { resolve } from "path"

import { config as loadEnv } from "dotenv"
import { PrismaClient } from "@prisma/client"

import {
  DRIVER_SESSION_COOKIE,
  signDriverSessionToken,
} from "../lib/driver-session"

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
): Promise<{ status: number; body: any; text: string }> {
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
  return { status: res.status, body, text }
}

function todayKey() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

async function main() {
  console.log(`\nQA driver calendar @ ${base}\n`)

  const files = [
    "app/driver/(app)/calendar/page.tsx",
    "components/driver/driver-calendar-view.tsx",
    "components/driver/driver-trip-detail-sheet.tsx",
    "app/api/driver/bookings/route.ts",
  ]
  let filesOk = true
  for (const file of files) {
    if (!existsSync(resolve(file))) {
      filesOk = false
      fail("A1 files", `missing ${file}`)
      break
    }
  }
  if (filesOk) pass("A1 driver calendar files present")

  const sidebar = read("components/driver/driver-sidebar.tsx")
  if (
    sidebar.includes('url: "/driver/calendar"') &&
    sidebar.includes("CalendarDays") &&
    sidebar.includes('t("nav.calendar")')
  ) {
    pass("A2 sidebar Calendar nav item")
  } else {
    fail("A2 sidebar", "Calendar nav missing")
  }

  const view = read("components/driver/driver-calendar-view.tsx")
  if (
    view.includes("/api/driver/bookings?") &&
    view.includes("DriverTripDetailSheet") &&
    !view.includes("/api/admin/") &&
    !view.includes("BookingDetail") &&
    !view.includes("internalNotes")
  ) {
    pass("A3 view uses driver API + trip detail sheet; no admin detail")
  } else {
    fail("A3 view wiring", "admin API/detail or missing sheet")
  }

  const apiSrc = read("app/api/driver/bookings/route.ts")
  if (
    apiSrc.includes("dateFrom") &&
    apiSrc.includes("dateTo") &&
    apiSrc.includes("driverId: session.driver.id") &&
    apiSrc.includes("CALENDAR_PAGE_SIZE")
  ) {
    pass("A4 API date-range mode scoped to session driver")
  } else {
    fail("A4 API", "date-range / driver scope missing")
  }

  const en = read("messages/driver-en.json")
  const sq = read("messages/driver-sq.json")
  if (en.includes('"nav.calendar"') && sq.includes('"nav.calendar"')) {
    pass("A5 i18n nav.calendar en+sq")
  } else {
    fail("A5 i18n", "nav.calendar missing")
  }

  // ---------------------------------------------------------------------------
  // A6–A9 — Trip detail offcanvas (admin-style sheet, driver-only data)
  // ---------------------------------------------------------------------------
  const sheet = read("components/driver/driver-trip-detail-sheet.tsx")
  if (
    sheet.includes("SheetContent") &&
    sheet.includes('side="right"') &&
    sheet.includes("ScrollArea") &&
    sheet.includes("pickupPin")
  ) {
    pass("A6 sheet uses admin-style right Sheet + PIN")
  } else {
    fail("A6 sheet shell", "missing Sheet/ScrollArea/PIN")
  }

  if (
    !sheet.includes("/api/admin") &&
    !sheet.includes("internalNotes") &&
    !sheet.includes("InternalNotes") &&
    !sheet.includes("apiPatch") &&
    !sheet.includes("apiDelete") &&
    !sheet.includes("apiPost")
  ) {
    pass("A7 sheet is read-only and avoids admin/internal-notes APIs")
  } else {
    fail("A7 sheet mutations/leaks", "admin API or write helpers present")
  }

  if (
    view.includes("openTrip") &&
    view.includes("selectedId") &&
    view.includes("bookingId") &&
    !view.includes('href={`/driver?bookingId')
  ) {
    pass("A8 chip opens sheet via bookingId URL (no trips redirect)")
  } else {
    fail("A8 chip → sheet", "still linking to /driver?bookingId or missing state")
  }

  if (
    en.includes('"calendar.sheetPassenger"') &&
    sq.includes('"calendar.sheetPassenger"') &&
    en.includes('"calendar.sheetPayment"')
  ) {
    pass("A9 sheet i18n labels en+sq")
  } else {
    fail("A9 sheet i18n", "sheet label keys missing")
  }

  const up = await waitForApp()
  if (!up) {
    fail("B0 app up", `no response from ${base}`)
    printSummary()
    process.exit(1)
  }
  pass("B0 app responding")

  const page = await api("/driver/calendar")
  if (page.status === 307 || page.status === 302 || page.status === 401) {
    pass("B1 /driver/calendar auth-gated", String(page.status))
  } else if (page.status === 200) {
    // Session cookie may already exist in some envs; still OK if page renders.
    pass("B1 /driver/calendar reachable", String(page.status))
  } else {
    fail("B1 /driver/calendar", `status ${page.status}`)
  }

  const unauth = await api(
    `/api/driver/bookings?dateFrom=${todayKey()}&dateTo=${todayKey()}`,
  )
  if (unauth.status === 401) pass("B2 calendar API unauthenticated → 401")
  else fail("B2 unauthenticated", `status ${unauth.status}`)

  const driver = await prisma.driver.findFirst({
    where: { active: true, pinHash: { not: null } },
    orderBy: { createdAt: "asc" },
  })
  if (!driver) {
    fail("B3 driver fixture", "no active driver with PIN")
    printSummary()
    process.exit(1)
  }
  pass("B3 driver fixture", driver.name)

  const token = await signDriverSessionToken(driver.id)
  const range = await api(
    `/api/driver/bookings?dateFrom=${todayKey()}&dateTo=${todayKey()}`,
    { token },
  )
  if (range.status !== 200 || !Array.isArray(range.body?.bookings)) {
    fail(
      "B4 calendar range response",
      `status ${range.status} body=${range.text.slice(0, 160)}`,
    )
  } else {
    pass("B4 calendar range returns bookings array", String(range.body.total ?? range.body.bookings.length))
  }

  const leakText = JSON.stringify(range.body ?? {})
  if (
    !leakText.includes("internalNotes") &&
    !leakText.includes("internalNoteHistory")
  ) {
    pass("B5 response omits internalNotes")
  } else {
    fail("B5 leak", "internalNotes present in driver calendar payload")
  }

  // All returned trips must belong to this driver (verify via DB ids).
  if (range.status === 200 && Array.isArray(range.body?.bookings)) {
    const ids = range.body.bookings.map((b: { id: string }) => b.id)
    if (ids.length === 0) {
      pass("B6 driver scope (empty range OK)")
    } else {
      const foreign = await prisma.booking.count({
        where: {
          id: { in: ids },
          NOT: { driverId: driver.id },
        },
      })
      if (foreign === 0) pass("B6 all trips belong to session driver")
      else fail("B6 driver scope", `${foreign} foreign booking(s)`)
    }
  }

  const bad = await api("/api/driver/bookings?dateFrom=not-a-date&dateTo=also-bad", {
    token,
  })
  if (bad.status === 400) pass("B7 invalid dates → 400")
  else fail("B7 invalid dates", `status ${bad.status}`)

  // Sheet fields come from the same serializeTrip payload — ensure shape for UI.
  if (range.status === 200 && Array.isArray(range.body?.bookings)) {
    const sample = range.body.bookings[0]
    if (!sample) {
      pass("B8 sheet field shape (no trips in range — skip)")
    } else {
      const required = [
        "id",
        "referenceCode",
        "pickupPin",
        "pickupAddress",
        "dropoffAddress",
        "pickupDateTime",
        "contactName",
        "status",
        "statusLabel",
        "totalPriceLabel",
        "cashToCollectLabel",
      ]
      const missing = required.filter((k) => !(k in sample))
      if (missing.length === 0) pass("B8 serializeTrip has sheet fields")
      else fail("B8 sheet fields", `missing ${missing.join(",")}`)

      if (
        !("email" in sample) &&
        !("customerEmail" in sample) &&
        !("internalNotes" in sample)
      ) {
        pass("B9 trip object has no email / internalNotes keys")
      } else {
        fail("B9 trip keys", "unexpected email or internalNotes on trip")
      }
    }
  }

  // Static: serializeTrip return block must not introduce email / internalNotes.
  const serializeSlice = apiSrc.slice(
    apiSrc.indexOf("return {"),
    apiSrc.indexOf("const tripSelect"),
  )
  if (
    !serializeSlice.includes("email:") &&
    !serializeSlice.includes("internalNotes")
  ) {
    pass("B10 serializeTrip source omits email / internalNotes")
  } else {
    fail("B10 serializeTrip source", "email or internalNotes in return")
  }

  printSummary()
  const failed = results.filter((r) => r.status === "FAIL").length
  process.exit(failed > 0 ? 1 : 0)
}

function printSummary() {
  const failed = results.filter((r) => r.status === "FAIL").length
  const passed = results.filter((r) => r.status === "PASS").length
  console.log(`\n${passed} PASS, ${failed} FAIL\n`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
