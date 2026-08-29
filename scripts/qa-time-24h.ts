/**
 * QA: booking time UI is 24-hour; storage stays ISO / wall-clock 24h.
 *
 * Run: npm run test:time-24h
 * Docker: docker compose -f docker-compose.dev.yml exec -T app npm run test:time-24h
 */
import { readFileSync, existsSync } from "fs"
import { resolve } from "path"

import {
  formatDateTime,
  formatHour24Option,
  formatTime,
} from "../lib/format"
import {
  getZonedWallTime,
  zonedWallTimeToIso,
} from "../lib/timezone"
import { formatHeroDateLabel } from "../components/marketing/hero-datetime-picker"

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

/** 24h clock HH:MM (optional leading zero on hour depending on Intl). */
const H24_RE = /\b([01]?\d|2[0-3]):[0-5]\d\b/
const AMPM_LEAK_RE = /\b(AM|PM)\b/i

async function main() {
  console.log("\nQA time 24-hour display\n")

  // A — Hour option labels
  let hoursOk = true
  for (const [h, expected] of [
    [0, "00"],
    [1, "01"],
    [9, "09"],
    [12, "12"],
    [15, "15"],
    [23, "23"],
  ] as const) {
    const got = formatHour24Option(h)
    if (got !== expected) {
      hoursOk = false
      fail("A1 formatHour24Option", `${h} → ${got} (expected ${expected})`)
    }
  }
  if (hoursOk) pass("A1 formatHour24Option key hours")

  let all24Ok = true
  for (let h = 0; h < 24; h++) {
    const label = formatHour24Option(h)
    if (!/^\d{2}$/.test(label) || Number(label) !== h) {
      all24Ok = false
      fail("A2 formatHour24Option all hours", `${h} → ${label}`)
    }
  }
  if (all24Ok) pass("A2 formatHour24Option covers 0–23")

  if (formatHour24Option(24) === "00" && formatHour24Option(-1) === "23") {
    pass("A3 formatHour24Option wraps out-of-range")
  } else {
    fail(
      "A3 wrap",
      `24=${formatHour24Option(24)} -1=${formatHour24Option(-1)}`,
    )
  }

  // B — Shared formatters (Europe/Tirane wall times)
  const afternoonIso = zonedWallTimeToIso(2026, 5, 15, 15, 50)
  const morningIso = zonedWallTimeToIso(2026, 5, 15, 9, 5)
  const midnightIso = zonedWallTimeToIso(2026, 5, 15, 0, 0)
  const noonIso = zonedWallTimeToIso(2026, 5, 15, 12, 0)

  for (const [name, iso, expect] of [
    ["afternoon", afternoonIso, /15:50/],
    ["morning", morningIso, /09:05|9:05/],
    ["midnight", midnightIso, /00:00|24:00/],
    ["noon", noonIso, /12:00/],
  ] as const) {
    const time = formatTime(iso)
    const dateTime = formatDateTime(iso)
    if (expect.test(time) && !AMPM_LEAK_RE.test(time)) {
      pass(`B1 formatTime ${name}`, time)
    } else {
      fail(`B1 formatTime ${name}`, time)
    }
    if (
      H24_RE.test(dateTime) &&
      expect.test(dateTime) &&
      !AMPM_LEAK_RE.test(dateTime)
    ) {
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

  // C — Hero label
  const hero = formatHeroDateLabel(afternoonIso)
  if (H24_RE.test(hero) && /15:50/.test(hero) && !AMPM_LEAK_RE.test(hero)) {
    pass("C1 formatHeroDateLabel 24h", hero)
  } else {
    fail("C1 formatHeroDateLabel", hero)
  }

  // D — Timezone wall math unchanged
  const wall = getZonedWallTime(afternoonIso)
  if (wall.hour === 15 && wall.minute === 50) {
    pass("D1 getZonedWallTime still 24h parts", `${wall.hour}:${wall.minute}`)
  } else {
    fail("D1 wall", `${wall.hour}:${wall.minute}`)
  }

  const threePmIso = zonedWallTimeToIso(2026, 5, 15, 15, 0)
  const threePmWall = getZonedWallTime(threePmIso)
  if (
    threePmWall.hour === 15 &&
    formatHour24Option(threePmWall.hour) === "15"
  ) {
    pass("D2 picker value 15 ↔ label 15", threePmIso)
  } else {
    fail("D2 round-trip", `${threePmWall.hour}`)
  }

  // E — Source guards
  const formatSrc = readFileSync(resolve("lib/format.ts"), "utf8")
  if (
    formatSrc.includes("hour12: false") &&
    formatSrc.includes("formatHour24Option") &&
    !/dateTimeDisplayOptions[\s\S]*?hour12:\s*true/.test(formatSrc)
  ) {
    pass("E1 lib/format.ts display uses hour12: false")
  } else {
    fail("E1 lib/format.ts", "still forcing 12h display")
  }

  const tzSrc = readFileSync(resolve("lib/timezone.ts"), "utf8")
  if (tzSrc.includes("hour12: false")) {
    pass("E2 lib/timezone.ts keeps hour12: false for wall math")
  } else {
    fail("E2 lib/timezone.ts", "missing hour12: false")
  }

  const heroSrc = readFileSync(
    resolve("components/marketing/hero-datetime-picker.tsx"),
    "utf8",
  )
  if (
    heroSrc.includes("formatHour24Option") &&
    heroSrc.includes("hour12: false")
  ) {
    pass("E3 hero-datetime-picker uses 24h labels + display")
  } else {
    fail("E3 hero-datetime-picker", "missing 24h wiring")
  }

  const adminSrc = readFileSync(
    resolve("components/admin/date-field.tsx"),
    "utf8",
  )
  if (
    adminSrc.includes("formatHour24Option") &&
    adminSrc.includes("hour12: false")
  ) {
    pass("E4 admin date-field uses 24h labels + display")
  } else {
    fail("E4 admin date-field", "missing 24h wiring")
  }

  if (existsSync(resolve("components/driver/driver-dashboard-view.tsx"))) {
    const driverSrc = readFileSync(
      resolve("components/driver/driver-dashboard-view.tsx"),
      "utf8",
    )
    if (driverSrc.includes("hour12: false")) {
      pass("E5 driver dashboard pickup label hour12: false")
    } else {
      fail("E5 driver dashboard", "still hour12: true")
    }
  }

  const failed = results.filter((r) => r.status === "FAIL").length
  const passed = results.filter((r) => r.status === "PASS").length
  console.log("\n===== QA SUMMARY (time 24h) =====")
  console.log(`${passed} PASS, ${failed} FAIL\n`)
  process.exit(failed > 0 ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
