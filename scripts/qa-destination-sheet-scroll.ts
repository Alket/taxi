/**
 * Regression checks for homepage destination-sheet iOS scroll fix.
 * Full touch scrolling needs a real iPhone; this verifies the fix is wired
 * and that the iOS body-lock path no longer sets touch-action:none.
 *
 * Usage: npx tsx scripts/qa-destination-sheet-scroll.ts
 */
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { JSDOM } from "jsdom"

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

  if (
    select.includes("stopPropagation") &&
    select.includes("onTouchMove")
  ) {
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

async function assertLockRuntime() {
  const { window } = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "http://localhost:3000/",
    pretendToBeVisual: true,
  })

  // iPhone UA
  Object.defineProperty(window.navigator, "userAgent", {
    configurable: true,
    get: () =>
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  })

  // Minimal globals for the hook module side-effects
  ;(globalThis as any).window = window
  ;(globalThis as any).document = window.document
  ;(globalThis as any).navigator = window.navigator

  // Re-implement the lock path by importing after globals exist.
  // Dynamic import so the module reads our mocked navigator via isIOS().
  // Clear module cache if needed.
  const path = resolve("hooks/use-body-scroll-lock.ts")
  // Use Function to evaluate lock helpers by reading source — safer to
  // duplicate the critical iOS branch check against live document styles
  // by calling useBodyScrollLock through a tiny React render.

  const React = await import("react")
  const { createRoot } = await import("react-dom/client")
  const { act } = await import("react")
  const { useBodyScrollLock } = await import("../hooks/use-body-scroll-lock")

  function Probe({ locked }: { locked: boolean }) {
    useBodyScrollLock(locked)
    return null
  }

  const rootEl = window.document.createElement("div")
  window.document.body.appendChild(rootEl)
  const root = createRoot(rootEl)

  await act(async () => {
    root.render(React.createElement(Probe, { locked: true }))
  })
  await new Promise((r) => setTimeout(r, 30))

  const touch = window.document.body.style.touchAction
  const position = window.document.body.style.position
  const overflow = window.document.body.style.overflow

  if (touch === "none") {
    fail("R1 iOS lock touch-action", `got "${touch}"`)
  } else {
    pass("R1 iOS lock does not set touch-action:none", touch || "(empty)")
  }

  if (position === "fixed") {
    fail("R2 iOS lock position", `got "${position}" (should not be fixed)`)
  } else {
    pass("R2 iOS lock does not use position:fixed", position || "(empty)")
  }

  if (overflow === "hidden") {
    pass("R3 iOS lock still sets overflow hidden")
  } else {
    fail("R3 iOS lock overflow", `expected hidden, got "${overflow}"`)
  }

  await act(async () => {
    root.render(React.createElement(Probe, { locked: false }))
  })
  await new Promise((r) => setTimeout(r, 30))

  if (window.document.body.style.overflow !== "hidden") {
    pass("R4 iOS lock releases overflow")
  } else {
    fail("R4 release", "overflow still hidden")
  }

  // Desktop UA still uses fixed strategy
  Object.defineProperty(window.navigator, "userAgent", {
    configurable: true,
    get: () =>
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  })

  await act(async () => {
    root.render(React.createElement(Probe, { locked: true }))
  })
  await new Promise((r) => setTimeout(r, 30))

  if (window.document.body.style.position === "fixed") {
    pass("R5 desktop lock still uses position:fixed")
  } else {
    fail(
      "R5 desktop lock",
      `expected fixed, got "${window.document.body.style.position}"`,
    )
  }

  await act(async () => {
    root.unmount()
  })
  void path
}

async function main() {
  console.log("=== Source wiring ===")
  assertSource()
  console.log("\n=== Runtime body-lock (jsdom iPhone UA) ===")
  try {
    await assertLockRuntime()
  } catch (error) {
    fail("R0 runtime", (error as Error).message)
  }

  const passed = results.filter((r) => r.status === "PASS").length
  const failed = results.filter((r) => r.status === "FAIL").length
  console.log("\n===== SUMMARY =====")
  console.log(`PASS=${passed} FAIL=${failed}`)
  for (const r of results.filter((x) => x.status === "FAIL")) {
    console.log(`  FAIL: ${r.case} | ${r.detail}`)
  }
  console.log(
    "\nNote: real iPhone touch-scroll still needs a device check; browser e2e needs Playwright OS deps.",
  )
  process.exit(failed > 0 ? 1 : 0)
}

main()
