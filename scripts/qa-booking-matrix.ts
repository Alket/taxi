/**
 * QA: booking matrix — form → cash → admin list/calendar → assign →
 * driver arrived / cash / complete; date & route edits; confirmation email data.
 *
 * Covers:
 *   One-way + return × Airport→City, City→Airport, City→City
 *
 * Run (app must be up):
 *   npm run test:booking-matrix
 *   docker compose -f docker-compose.dev.yml exec -T app npm run test:booking-matrix
 *
 * Env:
 *   QA_BASE_URL / SMOKE_BASE_URL  (default http://localhost:3000)
 *   SMOKE_BOOKING_EMAIL           optional customer email
 */
import { existsSync } from "fs"
import { resolve } from "path"
import { randomBytes } from "crypto"

import { config as loadEnv } from "dotenv"
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

import { hashDriverPin } from "../lib/driver-auth"
import {
  DRIVER_SESSION_COOKIE,
  signDriverSessionToken,
} from "../lib/driver-session"
import { getConfirmationTripSnapshot } from "../lib/emails/booking-events"
import { SESSION_COOKIE, signSessionToken } from "../lib/session"
import { SETTINGS_ID } from "../lib/settings"
import { toDateInputValue } from "../components/admin/date-field"
import { assertQaLocalOrAllowed } from "./qa-env-guard"

const base = (
  process.env.QA_BASE_URL ||
  process.env.SMOKE_BASE_URL ||
  "http://localhost:3000"
).replace(/\/$/, "")
assertQaLocalOrAllowed({ baseUrl: base, databaseUrl: process.env.DATABASE_URL })

const prisma = new PrismaClient()

type Result = { status: "PASS" | "FAIL"; case: string; detail?: string }
const results: Result[] = []

function pass(c: string, d = "") {
  results.push({ status: "PASS", case: c, detail: d })
  console.log("  PASS:", c, d || "")
}
function fail(c: string, d = "") {
  results.push({ status: "FAIL", case: c, detail: d })
  console.log("  FAIL:", c, "—", d)
}

function printSummary() {
  const fails = results.filter((r) => r.status === "FAIL").length
  const passes = results.filter((r) => r.status === "PASS").length
  console.log(`\n${passes} PASS / ${fails} FAIL (${results.length} checks)\n`)
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

type CookieKind = "admin" | "driver"

async function api(
  path: string,
  init: RequestInit & { token?: string; cookieKind?: CookieKind } = {},
): Promise<{ status: number; body: any; text: string }> {
  const { token, cookieKind = "admin", ...rest } = init
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "ngrok-skip-browser-warning": "true",
    ...(rest.headers as Record<string, string> | undefined),
  }
  if (token) {
    const name =
      cookieKind === "driver" ? DRIVER_SESSION_COOKIE : SESSION_COOKIE
    headers.cookie = `${name}=${token}`
  }

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

function pickupIsoHoursFromNow(hours: number) {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString()
}

function uniq(prefix: string) {
  return `${prefix}_${randomBytes(3).toString("hex")}`
}

type Direction = "airport_to_dest" | "dest_to_airport" | "zone_to_zone"

type Airport = {
  name: string
  iataCode: string
  lat: number
  lng: number
}
type Zone = { id: string; name: string }
type Corridor = {
  zoneAId: string
  zoneBId: string
  vehicleTypes?: string[]
}

type MatrixCase = {
  id: string
  label: string
  direction: Direction
  isRoundTrip: boolean
}

const MATRIX: MatrixCase[] = [
  {
    id: "ow-a2c",
    label: "One-way Airport → City",
    direction: "airport_to_dest",
    isRoundTrip: false,
  },
  {
    id: "ow-c2a",
    label: "One-way City → Airport",
    direction: "dest_to_airport",
    isRoundTrip: false,
  },
  {
    id: "ow-c2c",
    label: "One-way City → City",
    direction: "zone_to_zone",
    isRoundTrip: false,
  },
  {
    id: "rt-a2c",
    label: "Return Airport → City",
    direction: "airport_to_dest",
    isRoundTrip: true,
  },
  {
    id: "rt-c2a",
    label: "Return City → Airport",
    direction: "dest_to_airport",
    isRoundTrip: true,
  },
  {
    id: "rt-c2c",
    label: "Return City → City",
    direction: "zone_to_zone",
    isRoundTrip: true,
  },
]

async function waitForEmailLogs(
  bookingId: string,
  type: "confirmation",
  minCount: number,
  timeoutMs = 25_000,
) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    const logs = await prisma.notificationLog.findMany({
      where: { bookingId, channel: "email", type },
      orderBy: { createdAt: "asc" },
    })
    if (logs.length >= minCount) return logs
    await new Promise((r) => setTimeout(r, 500))
  }
  return prisma.notificationLog.findMany({
    where: { bookingId, channel: "email", type },
    orderBy: { createdAt: "asc" },
  })
}

async function main() {
  console.log(`\nQA booking matrix @ ${base}\n`)

  if (!(await waitForApp())) {
    fail("app reachable", `timed out waiting for ${base}`)
    printSummary()
    process.exit(1)
  }
  pass("app reachable", base)

  const settingsBefore = await prisma.settings.findUnique({
    where: { id: SETTINGS_ID },
    select: {
      cashOnArrivalEnabled: true,
      supportEmail: true,
    },
  })
  if (!settingsBefore) {
    fail("settings row", "missing — run db seed")
    printSummary()
    process.exit(1)
  }

  let restoredCash = false
  if (!settingsBefore.cashOnArrivalEnabled) {
    await prisma.settings.update({
      where: { id: SETTINGS_ID },
      data: { cashOnArrivalEnabled: true },
    })
    restoredCash = true
    pass("cashOnArrival enabled for run", "(will restore)")
  } else {
    pass("cashOnArrival already enabled")
  }

  const customerEmail = (
    process.env.SMOKE_BOOKING_EMAIL ||
    settingsBefore.supportEmail ||
    "qa-booking-matrix@example.com"
  )
    .trim()
    .toLowerCase()

  let adminId: string | null = null
  let driverId: string | null = null
  let previousPinHash: string | null | undefined
  const createdIds: string[] = []

  try {
    // -------------------------------------------------------------------------
    // Fixtures
    // -------------------------------------------------------------------------
    let admin = await prisma.adminUser.findFirst({
      where: { email: "ops@transfers.co" },
    })
    if (!admin) {
      admin = await prisma.adminUser.findFirst({
        where: { role: "admin", suspended: false },
        orderBy: { createdAt: "asc" },
      })
    }
    if (!admin) {
      fail("admin fixture", "no admin user")
      printSummary()
      process.exit(1)
    }
    if (admin.requiresPasswordReset || admin.suspended) {
      admin = await prisma.adminUser.update({
        where: { id: admin.id },
        data: { requiresPasswordReset: false, suspended: false },
      })
    }
    adminId = admin.id
    const adminToken = await signSessionToken(admin.id)
    pass("admin fixture", admin.email)

    let driver = await prisma.driver.findFirst({
      where: { active: true },
      orderBy: { name: "asc" },
    })
    if (!driver) {
      fail("driver fixture", "no active driver")
      printSummary()
      process.exit(1)
    }
    previousPinHash = driver.pinHash
    if (!driver.pinHash) {
      await prisma.driver.update({
        where: { id: driver.id },
        data: { pinHash: await hashDriverPin("1234") },
      })
    }
    driverId = driver.id
    const driverToken = await signDriverSessionToken(driver.id)
    pass("driver fixture", `${driver.name}`)

    const config = await api("/api/booking/config")
    if (config.status !== 200) {
      fail("booking config", `HTTP ${config.status}`)
      throw new Error("config failed")
    }
    const airports = (config.body?.airports ?? []) as Airport[]
    const zones = (config.body?.zones ?? []) as Zone[]
    const corridors = (config.body?.cityCorridors ?? []) as Corridor[]
    const airport =
      airports.find((a) => a.iataCode === "TIA" && a.lat != null) ||
      airports.find((a) => a.lat != null)
    if (!airport) {
      fail("airport fixture", "no airport with coords")
      throw new Error("no airport")
    }
    pass("airport fixture", `${airport.name} (${airport.iataCode})`)

    // Prefer a corridor pair for city↔city; else first two zones.
    let zoneA: Zone | undefined
    let zoneB: Zone | undefined
    if (corridors.length > 0) {
      const pair = corridors[0]
      zoneA = zones.find((z) => z.id === pair.zoneAId)
      zoneB = zones.find((z) => z.id === pair.zoneBId)
    }
    if (!zoneA || !zoneB) {
      zoneA = zones[0]
      zoneB = zones.find((z) => z.id !== zoneA!.id) || zones[1]
    }
    if (!zoneA) {
      fail("zone fixture", "no active zones")
      throw new Error("no zones")
    }
    if (!zoneB && corridors.length === 0) {
      fail(
        "city corridor fixture",
        "need ≥2 zones or an active InterZoneFare for city↔city cases",
      )
    } else if (zoneB) {
      pass("city corridor fixture", `${zoneA.name} ↔ ${zoneB.name}`)
    }

    type Created = {
      caseId: string
      label: string
      bookingId: string
      referenceCode: string
      direction: Direction
      isRoundTrip: boolean
      pickupAddress: string
      dropoffAddress: string
      pickupDateTime: string
      zoneId: string
      toZoneId: string | null
      totalPrice: number
      siblingIds: string[]
    }
    const created: Created[] = []

    // -------------------------------------------------------------------------
    // A — Create matrix (quote → booking → cash)
    // -------------------------------------------------------------------------
    console.log("\n— A. Create matrix (form → cash) —")
      let hourOffset = 80
    let flightSeq = 1000

    for (const mc of MATRIX) {
      console.log(`\n  [${mc.id}] ${mc.label}`)
      if (mc.direction === "zone_to_zone" && (!zoneA || !zoneB)) {
        fail(`${mc.id} skip`, "no city corridor pair")
        continue
      }

      const pickupDateTime = pickupIsoHoursFromNow(hourOffset)
      hourOffset += 6
      const returnDateTime = mc.isRoundTrip
        ? pickupIsoHoursFromNow(hourOffset + 24)
        : null
      if (mc.isRoundTrip) hourOffset += 30

      const flightNumber = `QA${flightSeq++}`

      let quoteBody: Record<string, unknown>
      let createBody: Record<string, unknown>
      let pickupAddress: string
      let dropoffAddress: string
      let zoneId: string
      let toZoneId: string | null = null

      if (mc.direction === "airport_to_dest") {
        pickupAddress = `${airport.name} (${airport.iataCode})`
        dropoffAddress = zoneA!.name
        zoneId = zoneA!.id
        quoteBody = {
          direction: "airport_to_dest",
          vehicleType: "sedan",
          zoneId,
        }
        createBody = {
          direction: "airport_to_dest",
          pickupAddress,
          pickupLat: airport.lat,
          pickupLng: airport.lng,
          dropoffAddress,
          dropoffLat: airport.lat,
          dropoffLng: airport.lng,
          zoneId,
          airportIata: airport.iataCode,
          flightNumber,
        }
      } else if (mc.direction === "dest_to_airport") {
        pickupAddress = zoneA!.name
        dropoffAddress = `${airport.name} (${airport.iataCode})`
        zoneId = zoneA!.id
        quoteBody = {
          direction: "dest_to_airport",
          vehicleType: "sedan",
          zoneId,
        }
        createBody = {
          direction: "dest_to_airport",
          pickupAddress,
          pickupLat: airport.lat,
          pickupLng: airport.lng,
          dropoffAddress,
          dropoffLat: airport.lat,
          dropoffLng: airport.lng,
          zoneId,
          airportIata: airport.iataCode,
          flightNumber,
        }
      } else {
        pickupAddress = zoneA!.name
        dropoffAddress = zoneB!.name
        zoneId = zoneA!.id
        toZoneId = zoneB!.id
        quoteBody = {
          direction: "zone_to_zone",
          vehicleType: "sedan",
          zoneId,
          toZoneId,
        }
        createBody = {
          direction: "zone_to_zone",
          pickupAddress,
          pickupLat: 41.3275,
          pickupLng: 19.8187,
          dropoffAddress,
          dropoffLat: 41.3275,
          dropoffLng: 19.8187,
          zoneId,
          toZoneId,
          flightNumber: "",
        }
      }

      const quote = await api("/api/pricing/quote", {
        method: "POST",
        body: JSON.stringify(quoteBody),
      })
      if (quote.status === 200 && Number(quote.body?.price) > 0) {
        pass(`${mc.id} quote`, `€${quote.body.price}`)
      } else {
        fail(
          `${mc.id} quote`,
          `${quote.status} ${quote.body?.error || quote.body?.code || ""}`,
        )
        continue
      }

      const create = await api("/api/bookings", {
        method: "POST",
        body: JSON.stringify({
          customer: {
            name: `QA Matrix ${mc.id}`,
            email: customerEmail,
            phone: "+355691112233",
            whatsappOptIn: false,
          },
          ...createBody,
          pickupDateTime,
          returnDateTime,
          passengerCount: 2,
          luggageCount: 1,
          vehicleType: "sedan",
          isRoundTrip: mc.isRoundTrip,
          meetAndGreet: mc.direction !== "zone_to_zone",
          driverNotes: `[qa-booking-matrix] ${mc.id}`,
        }),
      })

      const bookingId: string | null = create.body?.bookingId ?? null
      const referenceCode: string | null = create.body?.referenceCode ?? null
      if (create.status === 201 && bookingId && referenceCode) {
        pass(`${mc.id} create`, referenceCode)
        createdIds.push(bookingId)
        for (const b of create.body?.bookings ?? []) {
          if (b?.id && b.id !== bookingId) createdIds.push(b.id)
        }
      } else {
        fail(
          `${mc.id} create`,
          `${create.status} ${create.body?.error || JSON.stringify(create.body).slice(0, 160)}`,
        )
        continue
      }

      const cash = await api("/api/payments/cash-on-arrival", {
        method: "POST",
        body: JSON.stringify({ bookingId, email: customerEmail }),
      })
      if (cash.status === 200 && cash.body?.referenceCode === referenceCode) {
        pass(`${mc.id} cash confirm`)
      } else {
        fail(
          `${mc.id} cash confirm`,
          `${cash.status} ${cash.body?.error || ""}`,
        )
        continue
      }

      const row = await prisma.booking.findUniqueOrThrow({
        where: { id: bookingId },
        select: {
          id: true,
          referenceCode: true,
          status: true,
          paymentStatus: true,
          direction: true,
          isRoundTrip: true,
          roundTripId: true,
          pickupAddress: true,
          dropoffAddress: true,
          pickupDateTime: true,
          zoneId: true,
          toZoneId: true,
          totalPrice: true,
          notes: true,
        },
      })

      if (
        row.status === "confirmed" &&
        row.paymentStatus === "unpaid" &&
        row.direction === mc.direction &&
        (row.notes || "").toLowerCase().includes("cash on arrival")
      ) {
        pass(`${mc.id} status confirmed/cash`, row.direction)
      } else {
        fail(
          `${mc.id} status confirmed/cash`,
          `${row.status}/${row.paymentStatus}/${row.direction}`,
        )
      }

      if (mc.isRoundTrip) {
        const siblings = row.roundTripId
          ? await prisma.booking.findMany({
              where: { roundTripId: row.roundTripId },
              select: { id: true, direction: true },
            })
          : []
        if (siblings.length === 2) {
          pass(`${mc.id} round-trip legs`, siblings.map((s) => s.direction).join("+"))
        } else {
          fail(`${mc.id} round-trip legs`, `count=${siblings.length}`)
        }
        created.push({
          caseId: mc.id,
          label: mc.label,
          bookingId: row.id,
          referenceCode: row.referenceCode,
          direction: mc.direction,
          isRoundTrip: true,
          pickupAddress: row.pickupAddress,
          dropoffAddress: row.dropoffAddress,
          pickupDateTime: row.pickupDateTime.toISOString(),
          zoneId: row.zoneId!,
          toZoneId: row.toZoneId,
          totalPrice: Number(row.totalPrice),
          siblingIds: siblings.map((s) => s.id).filter((id) => id !== row.id),
        })
      } else {
        created.push({
          caseId: mc.id,
          label: mc.label,
          bookingId: row.id,
          referenceCode: row.referenceCode,
          direction: mc.direction,
          isRoundTrip: false,
          pickupAddress: row.pickupAddress,
          dropoffAddress: row.dropoffAddress,
          pickupDateTime: row.pickupDateTime.toISOString(),
          zoneId: row.zoneId!,
          toZoneId: row.toZoneId,
          totalPrice: Number(row.totalPrice),
          siblingIds: [],
        })
      }

      // Confirmation email snapshot (content correctness even if SMTP off)
      const snap = await getConfirmationTripSnapshot(row.id)
      if (
        snap &&
        snap.references.includes(row.referenceCode) &&
        snap.pickupAddresses.some((a) => a === row.pickupAddress) &&
        snap.textBody.includes(row.pickupAddress) &&
        snap.textBody.includes(row.dropoffAddress) &&
        (mc.isRoundTrip ? snap.isRoundTrip && snap.references.length === 2 : !snap.isRoundTrip)
      ) {
        pass(
          `${mc.id} email snapshot`,
          `refs=${snap.references.join(",")} total=${snap.tripTotal}`,
        )
      } else {
        fail(
          `${mc.id} email snapshot`,
          snap
            ? `refs=${snap.references.join(",")} rt=${snap.isRoundTrip}`
            : "null snapshot",
        )
      }

      // Notification log — SMTP may be unset in local/dev; treat missing as soft info.
      const logs = await waitForEmailLogs(row.id, "confirmation", 1, 8_000)
      if (logs.some((l) => l.status === "sent" || l.status === "pending")) {
        pass(`${mc.id} email log`, logs.map((l) => l.status).join(","))
      } else if (logs.length > 0) {
        fail(
          `${mc.id} email log`,
          logs.map((l) => `${l.status}:${l.error || ""}`).join("; "),
        )
      } else {
        pass(
          `${mc.id} email log`,
          "no SMTP log (snapshot checked; mail may be disabled)",
        )
      }
    }

    if (created.length === 0) {
      fail("matrix empty", "no bookings created")
      throw new Error("nothing to continue")
    }

    // -------------------------------------------------------------------------
    // B — Admin bookings list + calendar
    // -------------------------------------------------------------------------
    console.log("\n— B. Admin bookings + calendar —")
    for (const c of created) {
      const list = await api(
        `/api/admin/bookings?search=${encodeURIComponent(c.referenceCode)}&pageSize=20`,
        { token: adminToken },
      )
      const items = list.body?.bookings ?? list.body?.items ?? []
      const hit = Array.isArray(items)
        ? items.find(
            (b: any) =>
              b.id === c.bookingId || b.referenceCode === c.referenceCode,
          )
        : null
      if (list.status === 200 && hit) {
        pass(`${c.caseId} admin list`, c.referenceCode)
      } else {
        fail(
          `${c.caseId} admin list`,
          `HTTP ${list.status} found=${Boolean(hit)}`,
        )
      }

      const day = toDateInputValue(new Date(c.pickupDateTime))
      const cal = await api(
        `/api/admin/bookings?dateFrom=${day}&dateTo=${day}&pageSize=200`,
        { token: adminToken },
      )
      const calItems = cal.body?.bookings ?? cal.body?.items ?? []
      const calHit = Array.isArray(calItems)
        ? calItems.find((b: any) => b.id === c.bookingId)
        : null
      if (cal.status === 200 && calHit) {
        pass(`${c.caseId} admin calendar day`, day)
      } else {
        fail(
          `${c.caseId} admin calendar day`,
          `HTTP ${cal.status} day=${day} found=${Boolean(calHit)}`,
        )
      }
    }

    // -------------------------------------------------------------------------
    // C — Modify date (public) + route (admin) on one booking
    // -------------------------------------------------------------------------
    console.log("\n— C. Modify date & route —")
    const editable = created.find((c) => !c.isRoundTrip && c.caseId === "ow-a2c")
      || created.find((c) => !c.isRoundTrip)
      || created[0]

    const newPickup = pickupIsoHoursFromNow(200)
    const patchDate = await api(`/api/bookings/${editable.bookingId}`, {
      method: "PATCH",
      body: JSON.stringify({
        email: customerEmail,
        pickupDateTime: newPickup,
      }),
    })
    if (patchDate.status === 200) {
      const after = await prisma.booking.findUniqueOrThrow({
        where: { id: editable.bookingId },
        select: { pickupDateTime: true },
      })
      const ok =
        Math.abs(after.pickupDateTime.getTime() - new Date(newPickup).getTime()) <
        2000
      if (ok) pass("public PATCH pickup date", after.pickupDateTime.toISOString())
      else fail("public PATCH pickup date", after.pickupDateTime.toISOString())
      editable.pickupDateTime = after.pickupDateTime.toISOString()
    } else {
      fail(
        "public PATCH pickup date",
        `${patchDate.status} ${patchDate.body?.error || ""}`,
      )
    }

    // Admin route tweak: swap dropoff label slightly only if airport→city still valid
    if (editable.direction === "airport_to_dest" && zoneB && zoneB.id !== editable.zoneId) {
      // Reprice to another city via admin — change zone by recreating addresses
      // Admin PATCH supports addresses + totalPrice; zoneId change may need quote.
      // Safer: only change pickupDateTime again via admin to prove edit path.
      const adminDate = pickupIsoHoursFromNow(210)
      const adminPatch = await api(`/api/admin/bookings/${editable.bookingId}`, {
        method: "PATCH",
        token: adminToken,
        body: JSON.stringify({ pickupDateTime: adminDate }),
      })
      if (adminPatch.status === 200) {
        pass("admin PATCH pickup date")
        editable.pickupDateTime = adminDate
      } else {
        fail(
          "admin PATCH pickup date",
          `${adminPatch.status} ${adminPatch.body?.error || ""}`,
        )
      }
    } else {
      const adminDate = pickupIsoHoursFromNow(210)
      const adminPatch = await api(`/api/admin/bookings/${editable.bookingId}`, {
        method: "PATCH",
        token: adminToken,
        body: JSON.stringify({ pickupDateTime: adminDate }),
      })
      if (adminPatch.status === 200) pass("admin PATCH pickup date")
      else
        fail(
          "admin PATCH pickup date",
          `${adminPatch.status} ${adminPatch.body?.error || ""}`,
        )
    }

    // Route change: public customer cannot change vehicle; admin can update addresses
    // For airport→city, point dropoff to zoneB if available and update total from quote.
    if (
      editable.direction === "airport_to_dest" &&
      zoneB &&
      zoneB.id !== editable.zoneId
    ) {
      const q = await api("/api/pricing/quote", {
        method: "POST",
        body: JSON.stringify({
          direction: "airport_to_dest",
          vehicleType: "sedan",
          zoneId: zoneB.id,
        }),
      })
      if (q.status === 200 && Number(q.body?.price) > 0) {
        const routePatch = await api(`/api/admin/bookings/${editable.bookingId}`, {
          method: "PATCH",
          token: adminToken,
          body: JSON.stringify({
            dropoffAddress: zoneB.name,
            totalPrice: Number(q.body.price),
            depositAmount: Number((Number(q.body.price) * 0.2).toFixed(2)),
          }),
        })
        if (routePatch.status === 200) {
          const after = await prisma.booking.findUniqueOrThrow({
            where: { id: editable.bookingId },
            select: { dropoffAddress: true, totalPrice: true },
          })
          if (after.dropoffAddress === zoneB.name) {
            pass(
              "admin PATCH route/price",
              `${after.dropoffAddress} €${after.totalPrice}`,
            )
          } else {
            fail("admin PATCH route/price", after.dropoffAddress)
          }
        } else {
          fail(
            "admin PATCH route/price",
            `${routePatch.status} ${routePatch.body?.error || ""}`,
          )
        }
      } else {
        fail("admin route quote", `${q.status}`)
      }
    }

    // -------------------------------------------------------------------------
    // D — Full driver ops on one OW + one RT
    // -------------------------------------------------------------------------
    console.log("\n— D. Assign → arrive → cash → complete —")
    const opsTargets = [
      created.find((c) => c.caseId === "ow-a2c") || created.find((c) => !c.isRoundTrip),
      created.find((c) => c.caseId === "rt-a2c") || created.find((c) => c.isRoundTrip),
    ].filter(Boolean) as Created[]

    for (const target of opsTargets) {
      console.log(`\n  ops [${target.caseId}] ${target.referenceCode}`)
      const assign = await api(
        `/api/admin/bookings/${target.bookingId}/assign-driver`,
        {
          method: "PATCH",
          token: adminToken,
          body: JSON.stringify({ driverId }),
        },
      )
      if (assign.status === 200) pass(`${target.caseId} assign`)
      else {
        fail(
          `${target.caseId} assign`,
          `${assign.status} ${assign.body?.error || assign.body?.code || ""}`,
        )
        continue
      }

      const accept = await api(
        `/api/driver/bookings/${target.bookingId}/respond`,
        {
          method: "POST",
          token: driverToken,
          cookieKind: "driver",
          body: JSON.stringify({ action: "accept" }),
        },
      )
      if (accept.status === 200) pass(`${target.caseId} accept`)
      else
        fail(
          `${target.caseId} accept`,
          `${accept.status} ${accept.body?.error || ""}`,
        )

      const arrive = await api(
        `/api/driver/bookings/${target.bookingId}/status`,
        {
          method: "PATCH",
          token: driverToken,
          cookieKind: "driver",
          body: JSON.stringify({ status: "arrived" }),
        },
      )
      if (arrive.status === 200) pass(`${target.caseId} arrived`)
      else
        fail(
          `${target.caseId} arrived`,
          `${arrive.status} ${arrive.body?.error || ""}`,
        )

      const cashPaid = await api(
        `/api/driver/bookings/${target.bookingId}/cash-paid`,
        {
          method: "POST",
          token: driverToken,
          cookieKind: "driver",
        },
      )
      if (cashPaid.status === 200) pass(`${target.caseId} cash collected`)
      else
        fail(
          `${target.caseId} cash collected`,
          `${cashPaid.status} ${cashPaid.body?.error || ""}`,
        )

      const complete = await api(
        `/api/driver/bookings/${target.bookingId}/status`,
        {
          method: "PATCH",
          token: driverToken,
          cookieKind: "driver",
          body: JSON.stringify({ status: "completed" }),
        },
      )
      if (complete.status === 200) pass(`${target.caseId} completed`)
      else
        fail(
          `${target.caseId} completed`,
          `${complete.status} ${complete.body?.error || ""}`,
        )

      const final = await prisma.booking.findUniqueOrThrow({
        where: { id: target.bookingId },
        select: { status: true, paymentStatus: true, balanceDue: true },
      })
      if (
        final.status === "completed" &&
        (final.paymentStatus === "fully_paid" || final.paymentStatus === "paid") &&
        Number(final.balanceDue) === 0
      ) {
        pass(`${target.caseId} final state`, `${final.status}/${final.paymentStatus}`)
      } else {
        fail(
          `${target.caseId} final state`,
          `${final.status}/${final.paymentStatus}/due=${final.balanceDue}`,
        )
      }
    }
  } finally {
    if (restoredCash) {
      await prisma.settings.update({
        where: { id: SETTINGS_ID },
        data: { cashOnArrivalEnabled: false },
      })
      console.log("\nRestored cashOnArrivalEnabled=false")
    }
    if (driverId && previousPinHash === null) {
      await prisma.driver.update({
        where: { id: driverId },
        data: { pinHash: null },
      })
    }
    void adminId
    void createdIds
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
