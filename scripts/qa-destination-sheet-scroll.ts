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
  const iosHook = readFileSync(
    resolve("hooks/use-ios-sheet-scroll.ts"),
    "utf8",
  )

  if (select.includes("useIosSheetScroll(sheetActive, listRef)")) {
    pass("S1 uses iOS sheet scroll hook")
  } else {
    fail("S1", "expected useIosSheetScroll(sheetActive, listRef)")
  }

  if (select.includes('modal={isIOS ? "trap-focus" : true}')) {
    pass("S2 iOS uses trap-focus (no Base UI scroll lock)")
  } else {
    fail("S2", 'expected modal={isIOS ? "trap-focus" : true}')
  }

  if (select.includes('data-ios-sheet-scroll=""')) {
    pass("S3 list marked data-ios-sheet-scroll")
  } else {
    fail("S3", "missing data-ios-sheet-scroll on list")
  }

  if (
    iosHook.includes('body.style.position = "fixed"') &&
    iosHook.includes("event.preventDefault()") &&
    iosHook.includes("el.scrollTop = next")
  ) {
    pass("S4 iOS hook freezes body + drives list scrollTop")
  } else {
    fail("S4", "ios hook missing body freeze or manual scroll")
  }

  if (
    iosHook.includes('addEventListener("touchmove"') &&
    iosHook.includes("passive: false")
  ) {
    pass("S5 non-passive touchmove for preventDefault")
  } else {
    fail("S5", "touchmove must be non-passive")
  }

  if (!/autoFocus/.test(select)) {
    pass("S6 no autoFocus on destination search")
  } else {
    fail("S6", "autoFocus still present")
  }

  if (select.includes("useBodyScrollLock(sheetActive && !isIOS)")) {
    pass("S7 non-iOS still uses body scroll lock")
  } else {
    fail("S7", "expected useBodyScrollLock(sheetActive && !isIOS)")
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
