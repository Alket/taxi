/**
 * Regression checks for homepage destination-sheet iOS scroll fix.
 * Source-only (no jsdom) so `next build` / Docker never typecheck-fails on this file.
 *
 * Usage: npx tsx scripts/qa-destination-sheet-scroll.ts
 */
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

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

function assertSource() {
  const select = readFileSync(
    resolve("components/marketing/hero-field-select.tsx"),
    "utf8",
  )
  const lock = readFileSync(resolve("hooks/use-body-scroll-lock.ts"), "utf8")

  if (select.includes("sheetOpen && !isIOS")) {
    pass("S1 hero sheet skips body lock on iOS")
  } else {
    fail("S1", "expected useBodyScrollLock(... && !isIOS)")
  }

  if (select.includes('touchAction: "pan-y"')) {
    pass("S2 list uses touch-action pan-y")
  } else {
    fail("S2", "missing touchAction pan-y on list")
  }

  if (select.includes("listRef") && select.includes("scrollTop = 1")) {
    pass("S3 iOS scroll-layer wake on open")
  } else {
    fail("S3", "missing listRef scroll nudge")
  }

  if (select.includes("stopPropagation") && select.includes("onTouchMove")) {
    pass("S4 list stops touchmove propagation")
  } else {
    fail("S4", "missing onTouchMove stopPropagation")
  }

  if (!/autoFocus/.test(select)) {
    pass("S5 no autoFocus on destination search")
  } else {
    fail("S5", "autoFocus still present (breaks iOS scroll)")
  }

  if (
    lock.includes("usedFixedStrategy = !isIOS()") &&
    !lock.includes('touchAction = "none"')
  ) {
    pass("S6 body lock never sets touch-action:none")
  } else {
    fail("S6", "body lock still uses touch-action:none or wrong iOS strategy")
  }
}

function main() {
  console.log("=== Destination sheet iOS scroll wiring ===")
  assertSource()

  const passed = results.filter((r) => r.status === "PASS").length
  const failed = results.filter((r) => r.status === "FAIL").length
  console.log("\n===== SUMMARY =====")
  console.log(`PASS=${passed} FAIL=${failed}`)
  for (const r of results.filter((x) => x.status === "FAIL")) {
    console.log(`  FAIL: ${r.case} | ${r.detail}`)
  }
  process.exit(failed > 0 ? 1 : 0)
}

main()
