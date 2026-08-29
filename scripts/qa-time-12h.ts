/**
 * QA: booking time UI is 12-hour with AM/PM; storage stays 24-hour / ISO.
 *
 * Run: npm run test:time-12h
 * Optional (in Docker): docker compose -f docker-compose.dev.yml exec -T app npm run test:time-12h
 *
 * Does not mutate the database.
 */
import { readFileSync } from "fs"
import { resolve } from "path"

import {
  formatDateTime,
  formatHour12Option,
  formatTime,
} from "../lib/format"
import { formatHeroDateLabel } from "../components/marketing/hero-datetime-picker"
import {
  toDateTimeInputValue,
  parseDateTimeInputValue,
} from "../components/admin/date-field"
import {
  APP_TIMEZONE,
  getZonedWallTime,
  zonedWallTimeToIso,
} from "../lib/timezone"

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

/** Matches 12-hour clock with AM/PM (e.g. 4:05 PM, 12:00 AM). */
const AMPM_RE = /\b\d{1,2}:\d{2}\s?(AM|PM)\b/i

/** 24-hour hour:minute that would leak into UI (13–23). */
const LEAK_24H_RE = /\b(?:1[3-9]|2[0-3]):\d{2}\b/

function main() {
  console.log("\nQA time 12-hour (AM/PM) display\n")

  // ---------------------------------------------------------------------------
  // A — Hour option labels (picker values stay 0–23)
  // ---------------------------------------------------------------------------
  const hourCases: [number, string][] = [
    [0, "12 AM"],
    [1, "1 AM"],
    [11, "11 AM"],
    [12, "12 PM"],
    [13, "1 PM"],
    [15, "3 PM"],
    [23, "11 PM"],
  ]
  let hoursOk = true
  for (const [h, expected] of hourCases) {
    const got = formatHour12Option(h)
    if (got !== expected) {
      hoursOk = false
      fail("A1 formatHour12Option", `${h} → ${got} (expected ${expected})`)
      break
    }
  }
  if (hoursOk) pass("A1 formatHour12Option key hours")

  let all24Ok = true
  for (let h = 0; h < 24; h++) {
    const label = formatHour12Option(h)
    if (!/^(1[0-2]|[1-9]|12)\s(AM|PM)$/.test(label)) {
      all24Ok = false
      fail("A2 formatHour12Option all hours", `${h} → ${label}`)
      break
    }
  }
  if (all24Ok) pass("A2 formatHour12Option covers 0–23")

  if (formatHour12Option(24) === "12 AM" && formatHour12Option(-1) === "11 PM") {
    pass("A3 formatHour12Option wraps out-of-range")
  } else {
    fail(
      "A3 wrap",
      `24=${formatHour12Option(24)} -1=${formatHour12Option(-1)}`,
    )
  }

  // ---------------------------------------------------------------------------
  // B — Shared formatters show AM/PM for known Tirane wall times
  // ---------------------------------------------------------------------------
  // Europe/Tirane civil 15:50 → must display as 3:50 PM (not 15:50).
  const afternoonIso = zonedWallTimeToIso(2026, 7, 29, 15, 50)
  const morningIso = zonedWallTimeToIso(2026, 7, 29, 9, 5)
  const midnightIso = zonedWallTimeToIso(2026, 7, 29, 0, 0)
  const noonIso = zonedWallTimeToIso(2026, 7, 29, 12, 0)

  const samples: [string, string, RegExp][] = [
    ["afternoon", afternoonIso, /3:50\s?PM/i],
    ["morning", morningIso, /9:05\s?AM/i],
    ["midnight", midnightIso, /12:00\s?AM/i],
    ["noon", noonIso, /12:00\s?PM/i],
  ]

  for (const [name, iso, expect] of samples) {
    const time = formatTime(iso)
    const dateTime = formatDateTime(iso)
    if (expect.test(time) && !LEAK_24H_RE.test(time)) {
      pass(`B1 formatTime ${name}`, time)
    } else {
      fail(`B1 formatTime ${name}`, time)
    }
    if (AMPM_RE.test(dateTime) && expect.test(dateTime) && !LEAK_24H_RE.test(dateTime)) {
      pass(`B2 formatDateTime ${name}`, dateTime)
    } else {
      fail(`B2 formatDateTime ${name}`, dateTime)
    }
  }

  if (formatTime(null) === "—" && formatDateTime(null) === "—") {
    pass("B3 null → em dash")
  } else {
    fail("B3 null", `${formatTime(null)} / ${formatDateTime(null)}`)
  }

  // ---------------------------------------------------------------------------
  // C — Marketing hero label
  // ---------------------------------------------------------------------------
  const hero = formatHeroDateLabel(afternoonIso)
  if (AMPM_RE.test(hero) && /3:50\s?PM/i.test(hero) && !LEAK_24H_RE.test(hero)) {
    pass("C1 formatHeroDateLabel afternoon", hero)
  } else {
    fail("C1 formatHeroDateLabel", hero)
  }
  if (formatHeroDateLabel(null) === "Add date & time") {
    pass("C2 formatHeroDateLabel empty")
  } else {
    fail("C2 formatHeroDateLabel empty", formatHeroDateLabel(null))
  }

  // ---------------------------------------------------------------------------
  // D — Storage / wall-clock stay 24-hour (not UI)
  // ---------------------------------------------------------------------------
  const wall = getZonedWallTime(afternoonIso)
  if (wall.hour === 15 && wall.minute === 50) {
    pass("D1 getZonedWallTime still 24h parts", `${wall.hour}:${wall.minute}`)
  } else {
    fail("D1 getZonedWallTime", JSON.stringify(wall))
  }

  // Round-trip: 3 PM wall → ISO → wall still 15
  const threePmIso = zonedWallTimeToIso(2026, 11, 15, 15, 0)
  const threePmWall = getZonedWallTime(threePmIso)
  if (threePmWall.hour === 15 && formatHour12Option(threePmWall.hour) === "3 PM") {
    pass("D2 picker value 15 ↔ label 3 PM", threePmIso)
  } else {
    fail("D2 picker mapping", JSON.stringify(threePmWall))
  }

  const localDt = toDateTimeInputValue(new Date(2026, 7, 29, 15, 50, 0, 0))
  if (/T15:50$/.test(localDt)) {
    pass("D3 admin toDateTimeInputValue stays HH:mm 24h", localDt)
  } else {
    fail("D3 toDateTimeInputValue", localDt)
  }

  const parsed = parseDateTimeInputValue("2026-08-29T15:50")
  if (parsed && parsed.getHours() === 15 && parsed.getMinutes() === 50) {
    pass("D4 parseDateTimeInputValue reads 24h storage")
  } else {
    fail("D4 parseDateTimeInputValue", String(parsed))
  }

  if (APP_TIMEZONE === "Europe/Tirane") {
    pass("D5 APP_TIMEZONE unchanged", APP_TIMEZONE)
  } else {
    fail("D5 APP_TIMEZONE", APP_TIMEZONE)
  }

  // ---------------------------------------------------------------------------
  // E — Source guard: display formatters must not force hour12:false
  // ---------------------------------------------------------------------------
  const formatSrc = readFileSync(resolve("lib/format.ts"), "utf8")
  if (
    formatSrc.includes("hour12: true") &&
    !/formatDateTime[\s\S]*?hour12:\s*false/.test(formatSrc) &&
    !/formatTime[\s\S]*?hour12:\s*false/.test(formatSrc)
  ) {
    pass("E1 lib/format.ts display uses hour12: true")
  } else {
    fail("E1 lib/format.ts", "display still 24-hour")
  }

  const tzSrc = readFileSync(resolve("lib/timezone.ts"), "utf8")
  if (tzSrc.includes("hour12: false")) {
    pass("E2 lib/timezone.ts keeps hour12: false for wall math")
  } else {
    fail("E2 lib/timezone.ts", "missing hour12: false (wall-clock parse)")
  }

  const heroSrc = readFileSync(
    resolve("components/marketing/hero-datetime-picker.tsx"),
    "utf8",
  )
  if (
    heroSrc.includes("formatHour12Option") &&
    heroSrc.includes("hour12: true")
  ) {
    pass("E3 hero-datetime-picker uses 12h labels + display")
  } else {
    fail("E3 hero-datetime-picker", "missing 12h wiring")
  }

  const adminSrc = readFileSync(resolve("components/admin/date-field.tsx"), "utf8")
  if (
    adminSrc.includes("formatHour12Option") &&
    adminSrc.includes("hour12: true")
  ) {
    pass("E4 admin date-field uses 12h labels + display")
  } else {
    fail("E4 admin date-field", "missing 12h wiring")
  }

  const driverSrc = readFileSync(
    resolve("components/driver/driver-dashboard-view.tsx"),
    "utf8",
  )
  if (driverSrc.includes("hour12: true")) {
    pass("E5 driver dashboard pickup label hour12: true")
  } else {
    fail("E5 driver dashboard", "still hour12: false")
  }

  // ---------------------------------------------------------------------------
  const passed = results.filter((r) => r.status === "PASS").length
  const failed = results.filter((r) => r.status === "FAIL").length
  console.log("\n===== QA SUMMARY (time 12h) =====")
  console.log(`PASS=${passed} FAIL=${failed}`)
  for (const r of results.filter((x) => x.status === "FAIL")) {
    console.log(`  FAIL: ${r.case} | ${r.detail}`)
  }

  if (failed > 0) process.exit(1)
}

try {
  main()
} catch (error) {
  console.error(error)
  process.exit(1)
}
