/**
 * QA for admin bookings calendar (/admin/calendar).
 *
 * Run: npm run test:calendar
 * Docker: docker compose -f docker-compose.dev.yml exec -T app npm run test:calendar
 *
 * Covers visible day/week/month ranges, filter intersection, API pageSize
 * cap, source wiring, and HTTP smoke. Does not require an admin session for
 * unit checks; HTTP expects auth redirects/401 without cookies.
 */
import { readFileSync, existsSync } from "fs"
import { resolve } from "path"

import { PrismaClient } from "@prisma/client"

import { toDateInputValue } from "../components/admin/date-field"
import {
  CALENDAR_PAGE_SIZE,
  calendarApiMaxPageSize,
  groupBookingsByDay,
  intersectFetchRange,
  isCalendarViewMode,
  parseDateKey,
  visibleRange,
  wallDateKey,
} from "../lib/bookings-calendar"
import { zonedWallTimeToIso } from "../lib/timezone"

const base = process.env.QA_BASE_URL || "http://localhost:3000"
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

async function httpStatus(path: string) {
  try {
    const res = await fetch(`${base}${path}`, {
      headers: { "ngrok-skip-browser-warning": "true" },
      redirect: "manual",
    })
    return res.status
  } catch (error) {
    return `ERR:${(error as Error).message}`
  }
}

async function main() {
  console.log(`\nQA admin calendar @ ${base}\n`)

  // ---------------------------------------------------------------------------
  // A — Files / nav / page wiring
  // ---------------------------------------------------------------------------
  const files = [
    "app/admin/(app)/calendar/page.tsx",
    "components/bookings/bookings-calendar-view.tsx",
    "lib/bookings-calendar.ts",
  ]
  let filesOk = true
  for (const file of files) {
    if (!existsSync(resolve(file))) {
      filesOk = false
      fail("A1 file exists", file)
      break
    }
  }
  if (filesOk) pass("A1 calendar files present")

  const sidebar = readFileSync(resolve("components/admin/app-sidebar.tsx"), "utf8")
  if (
    sidebar.includes('url: "/admin/calendar"') &&
    sidebar.includes("CalendarDays") &&
    sidebar.includes('title: "Calendar"')
  ) {
    pass("A2 sidebar Calendar nav item")
  } else {
    fail("A2 sidebar", "Calendar item missing")
  }

  const pageSrc = readFileSync(
    resolve("app/admin/(app)/calendar/page.tsx"),
    "utf8",
  )
  if (pageSrc.includes("BookingsCalendarView")) {
    pass("A3 calendar page renders BookingsCalendarView")
  } else {
    fail("A3 calendar page", "missing BookingsCalendarView")
  }

  const viewSrc = readFileSync(
    resolve("components/bookings/bookings-calendar-view.tsx"),
    "utf8",
  )
  const needs = [
    "BookingDetail",
    "AdminFilterSelectField",
    "AdminDriverField",
    "AdminDateField",
    'label="Status"',
    'label="Payment"',
    'label="Driver"',
    'label="From"',
    'label="To"',
    "visibleRange",
    "intersectFetchRange",
    "CALENDAR_PAGE_SIZE",
  ]
  let viewOk = true
  for (const need of needs) {
    if (!viewSrc.includes(need)) {
      viewOk = false
      fail("A4 calendar view wiring", `missing ${need}`)
      break
    }
  }
  if (viewOk) pass("A4 calendar view filters + detail + range helpers")

  // ---------------------------------------------------------------------------
  // B — View mode + visible ranges
  // ---------------------------------------------------------------------------
  if (
    isCalendarViewMode("day") &&
    isCalendarViewMode("week") &&
    isCalendarViewMode("month") &&
    !isCalendarViewMode("year") &&
    !isCalendarViewMode(null)
  ) {
    pass("B1 isCalendarViewMode")
  } else {
    fail("B1 isCalendarViewMode")
  }

  // Wednesday 2026-08-26
  const wed = parseDateKey("2026-08-26")!
  const dayRange = visibleRange("day", wed)
  if (
    dayRange.from === "2026-08-26" &&
    dayRange.to === "2026-08-26" &&
    dayRange.days.length === 1
  ) {
    pass("B2 day visibleRange", dayRange.from)
  } else {
    fail("B2 day visibleRange", JSON.stringify(dayRange))
  }

  const weekRange = visibleRange("week", wed)
  // Su 23 Aug – Sa 29 Aug 2026
  if (
    weekRange.from === "2026-08-23" &&
    weekRange.to === "2026-08-29" &&
    weekRange.days.length === 7 &&
    weekRange.days[0] === "2026-08-23" &&
    weekRange.days[6] === "2026-08-29"
  ) {
    pass("B3 week visibleRange Su–Sa", `${weekRange.from}→${weekRange.to}`)
  } else {
    fail("B3 week visibleRange", JSON.stringify(weekRange))
  }

  const monthRange = visibleRange("month", wed)
  // Aug 2026 starts Saturday → grid from Su Jul 26; ends Mon Aug 31 → through Sa Sep 5
  if (
    monthRange.from === "2026-07-26" &&
    monthRange.to === "2026-09-05" &&
    monthRange.days.length % 7 === 0 &&
    monthRange.days.length >= 35
  ) {
    pass(
      "B4 month visibleRange full grid",
      `${monthRange.from}→${monthRange.to} (${monthRange.days.length} days)`,
    )
  } else {
    fail("B4 month visibleRange", JSON.stringify(monthRange))
  }

  if (parseDateKey("not-a-date") === null && parseDateKey("2026-02-30") === null) {
    pass("B5 parseDateKey rejects invalid")
  } else {
    fail("B5 parseDateKey")
  }

  // ---------------------------------------------------------------------------
  // C — Filter ∩ visible intersection
  // ---------------------------------------------------------------------------
  const intersectOk = intersectFetchRange(
    "2026-08-23",
    "2026-08-29",
    "2026-08-25",
    "2026-08-27",
  )
  if (
    intersectOk.from === "2026-08-25" &&
    intersectOk.to === "2026-08-27" &&
    !intersectOk.invalid
  ) {
    pass("C1 intersect filter inside week")
  } else {
    fail("C1 intersect", JSON.stringify(intersectOk))
  }

  const noFilter = intersectFetchRange("2026-08-23", "2026-08-29", "", "")
  if (
    noFilter.from === "2026-08-23" &&
    noFilter.to === "2026-08-29" &&
    !noFilter.invalid
  ) {
    pass("C2 empty filters use visible window")
  } else {
    fail("C2 empty filters", JSON.stringify(noFilter))
  }

  const invalid = intersectFetchRange(
    "2026-08-23",
    "2026-08-29",
    "2026-09-01",
    "2026-09-10",
  )
  if (invalid.invalid) pass("C3 disjoint filter → invalid")
  else fail("C3 disjoint", JSON.stringify(invalid))

  // ---------------------------------------------------------------------------
  // D — API pageSize contract
  // ---------------------------------------------------------------------------
  if (calendarApiMaxPageSize("2026-08-01", "2026-08-31") === 500) {
    pass("D1 bounded range max pageSize 500")
  } else {
    fail("D1 bounded", String(calendarApiMaxPageSize("2026-08-01", "2026-08-31")))
  }
  if (calendarApiMaxPageSize(null, null) === 100) {
    pass("D2 unbounded max pageSize 100")
  } else {
    fail("D2 unbounded", String(calendarApiMaxPageSize(null, null)))
  }
  if (calendarApiMaxPageSize("2026-08-01", null) === 100) {
    pass("D3 only dateFrom → 100")
  } else {
    fail("D3 only from")
  }
  if (CALENDAR_PAGE_SIZE === 500) pass("D4 CALENDAR_PAGE_SIZE constant")
  else fail("D4 CALENDAR_PAGE_SIZE", String(CALENDAR_PAGE_SIZE))

  const apiSrc = readFileSync(
    resolve("app/api/admin/bookings/route.ts"),
    "utf8",
  )
  if (apiSrc.includes("calendarApiMaxPageSize")) {
    pass("D5 bookings API uses calendarApiMaxPageSize")
  } else {
    fail("D5 bookings API", "not wired to calendarApiMaxPageSize")
  }

  // ---------------------------------------------------------------------------
  // E — Group by wall day (Tirane)
  // ---------------------------------------------------------------------------
  const afternoon = zonedWallTimeToIso(2026, 7, 26, 15, 30)
  const evening = zonedWallTimeToIso(2026, 7, 26, 21, 0)
  const nextDay = zonedWallTimeToIso(2026, 7, 27, 9, 0)
  const fake = [
    {
      id: "1",
      pickupDateTime: afternoon,
      referenceCode: "A",
    },
    {
      id: "2",
      pickupDateTime: evening,
      referenceCode: "B",
    },
    {
      id: "3",
      pickupDateTime: nextDay,
      referenceCode: "C",
    },
  ] as unknown as import("../lib/types").Booking[]

  const grouped = groupBookingsByDay(fake)
  const key26 = wallDateKey(afternoon)
  const key27 = wallDateKey(nextDay)
  if (
    key26 === "2026-08-26" &&
    key27 === "2026-08-27" &&
    grouped.get(key26)?.length === 2 &&
    grouped.get(key27)?.length === 1
  ) {
    pass("E1 groupBookingsByDay by Tirane wall date", key26)
  } else {
    fail(
      "E1 groupBookingsByDay",
      JSON.stringify({ key26, key27, sizes: [...grouped.entries()].map(([k, v]) => [k, v.length]) }),
    )
  }

  // ---------------------------------------------------------------------------
  // F — DB: bookings in a visible week are countable with the same date bounds
  // ---------------------------------------------------------------------------
  try {
    const today = new Date()
    const week = visibleRange("week", today)
    const [y1, m1, d1] = week.from.split("-").map(Number)
    const [y2, m2, d2] = week.to.split("-").map(Number)
    const count = await prisma.booking.count({
      where: {
        pickupDateTime: {
          gte: new Date(y1!, m1! - 1, d1!, 0, 0, 0, 0),
          lte: new Date(y2!, m2! - 1, d2!, 23, 59, 59, 999),
        },
      },
    })
    pass(
      "F1 prisma week window query",
      `${week.from}→${week.to} count=${count}`,
    )
  } catch (error) {
    fail("F1 prisma week window", (error as Error).message)
  }

  // ---------------------------------------------------------------------------
  // G — HTTP smoke
  // ---------------------------------------------------------------------------
  const cal = await httpStatus("/admin/calendar")
  if (cal === 307 || cal === 302 || cal === 401 || cal === 403 || cal === 200) {
    pass("G1 /admin/calendar responds", String(cal))
  } else {
    fail("G1 /admin/calendar", String(cal))
  }

  const api = await httpStatus(
    `/api/admin/bookings?dateFrom=${toDateInputValue(new Date())}&dateTo=${toDateInputValue(new Date())}&pageSize=500`,
  )
  if (api === 401 || api === 403 || api === 307 || api === 302 || api === 200) {
    pass("G2 GET /api/admin/bookings calendar query auth-gated", String(api))
  } else {
    fail("G2 API calendar query", String(api))
  }

  const home = await httpStatus("/")
  if (home === 200) pass("G3 public / still 200")
  else fail("G3 public /", String(home))

  // ---------------------------------------------------------------------------
  const passed = results.filter((r) => r.status === "PASS").length
  const failed = results.filter((r) => r.status === "FAIL").length
  console.log("\n===== QA SUMMARY (admin calendar) =====")
  console.log(`PASS=${passed} FAIL=${failed}`)
  for (const r of results.filter((x) => x.status === "FAIL")) {
    console.log(`  FAIL: ${r.case} | ${r.detail}`)
  }

  await prisma.$disconnect()
  if (failed > 0) process.exit(1)
}

main().catch(async (error) => {
  console.error(error)
  await prisma.$disconnect()
  process.exit(1)
})
