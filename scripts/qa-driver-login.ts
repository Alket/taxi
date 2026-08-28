/**
 * QA: driver login phone matching + alphanumeric PIN hashing.
 * Run: npm run test:driver-login
 *
 * Covers the WhatsApp collision fix and letter/number PIN support.
 */
import {
  findDriverForLoginPhone,
  hashDriverPin,
  normalizePhone,
  verifyDriverPin,
} from "../lib/driver-auth"
import { loginSchemaForQa } from "../lib/driver-login-schema"

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

async function main() {
  console.log("\nQA driver login\n")

  // --- normalizePhone ---
  const norms: [string, string][] = [
    ["+355683256010", "355683256010"],
    ["355 68 325 6010", "355683256010"],
    ["+355-68-325-6010", "355683256010"],
    ["  +355683256010  ", "355683256010"],
    ["abc", ""],
  ]
  for (const [raw, expected] of norms) {
    const got = normalizePhone(raw)
    if (got === expected) pass(`N normalize ${JSON.stringify(raw)}`, got || "(empty)")
    else fail(`N normalize ${JSON.stringify(raw)}`, `got ${got} expected ${expected}`)
  }

  // --- phone preferred over WhatsApp (the Alket/Fatjon bug) ---
  const fleet = [
    {
      name: "Fatjon",
      phone: "+355693414941",
      whatsappNumber: "+355683256010",
    },
    {
      name: "Alket",
      phone: "+355683256010",
      whatsappNumber: "+355683256010",
    },
  ]
  const hit = findDriverForLoginPhone(fleet, "+355683256010")
  if (hit?.name === "Alket") pass("M prefer primary phone over WhatsApp")
  else fail("M prefer primary phone over WhatsApp", hit?.name ?? "undefined")

  const hitSpaces = findDriverForLoginPhone(fleet, "355 68 325 6010")
  if (hitSpaces?.name === "Alket") pass("M loose formatting still prefers phone")
  else fail("M loose formatting", hitSpaces?.name ?? "undefined")

  // WhatsApp-only login when no primary phone owns the number
  const waOnly = [
    { name: "A", phone: "+111", whatsappNumber: "+999" },
    { name: "B", phone: "+222", whatsappNumber: "+888" },
  ]
  const viaWa = findDriverForLoginPhone(waOnly, "+999")
  if (viaWa?.name === "A") pass("M WhatsApp fallback when no phone match")
  else fail("M WhatsApp fallback", viaWa?.name ?? "undefined")

  const miss = findDriverForLoginPhone(fleet, "+355600000000")
  if (!miss) pass("M unknown phone → no match")
  else fail("M unknown phone", miss.name)

  // --- PIN schema (alphanumeric) ---
  const pinCases: { name: string; pin: string; ok: boolean }[] = [
    { name: "numeric 4", pin: "4821", ok: true },
    { name: "alphanumeric", pin: "Ab12", ok: true },
    { name: "letters only", pin: "Pass", ok: true },
    { name: "max 12", pin: "Abcdef123456", ok: true },
    { name: "too short", pin: "Ab1", ok: false },
    { name: "too long", pin: "Abcdef1234567", ok: false },
    { name: "empty", pin: "", ok: false },
  ]
  for (const tc of pinCases) {
    const parsed = loginSchemaForQa.safeParse({
      phone: "+355683256010",
      pin: tc.pin,
    })
    if (parsed.success === tc.ok) pass(`P schema ${tc.name}`)
    else fail(`P schema ${tc.name}`, `success=${parsed.success} expected ${tc.ok}`)
  }

  // --- hash / verify alphanumeric PIN ---
  const secret = "Alket9x"
  const hash = await hashDriverPin(secret)
  if (await verifyDriverPin(secret, hash)) pass("H alphanumeric PIN verify ok")
  else fail("H alphanumeric PIN verify ok")

  if (!(await verifyDriverPin("wrong1", hash))) pass("H wrong PIN rejected")
  else fail("H wrong PIN rejected")

  if (!(await verifyDriverPin("alket9x", hash))) {
    pass("H PIN verify is case-sensitive")
  } else {
    fail("H PIN verify is case-sensitive", "case folded unexpectedly")
  }

  // Security: collision scenario must not accept Fatjon PIN for Alket phone
  // (unit-level: matching must return Alket before any PIN check)
  const orderedWrongFirst = [
    {
      name: "Fatjon",
      phone: "+355693414941",
      whatsappNumber: "+355683256010",
      pin: "FFFF",
    },
    {
      name: "Alket",
      phone: "+355683256010",
      whatsappNumber: "+355683256010",
      pin: "AAAA",
    },
  ]
  const selected = findDriverForLoginPhone(orderedWrongFirst, "+355683256010")
  if (selected?.name === "Alket" && selected.pin === "AAAA") {
    pass("S collision: phone owner selected for PIN check")
  } else {
    fail(
      "S collision: phone owner selected for PIN check",
      JSON.stringify(selected),
    )
  }

  const failed = results.filter((r) => r.status === "FAIL")
  console.log(
    `\n${results.length - failed.length}/${results.length} passed` +
      (failed.length ? ` · ${failed.length} failed` : ""),
  )
  if (failed.length) process.exit(1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
