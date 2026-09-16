/**
 * QA: pick opposite city in From/To → swap route (marketing form).
 *
 * Example: Ksamil → Tirana City, then choose Tirana City in From →
 * becomes Tirana City → Ksamil (without clearing To first).
 *
 * Run: npm run test:place-swap
 * Docker: docker compose -f docker-compose.dev.yml exec -T app npm run test:place-swap
 */
import { existsSync, readFileSync } from "fs"
import { resolve } from "path"

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

import {
  buildCorridorNeighborMap,
  buildPlaceOptions,
  deriveRouteFromPlaces,
  filterPlacesForOppositeEnd,
  zonePlaceKey,
  type BookingPlaceOption,
} from "../lib/booking-places"
import { canonicalZonePair } from "../lib/pricing-admin"
import { assertQaLocalOrAllowed } from "./qa-env-guard"

const base = (process.env.QA_BASE_URL || "http://localhost:3000").replace(
  /\/$/,
  "",
)
assertQaLocalOrAllowed({ baseUrl: base, databaseUrl: process.env.DATABASE_URL })
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
  return fails
}
function read(rel: string) {
  return readFileSync(resolve(rel), "utf8")
}

async function waitForApp(timeoutMs = 60_000) {
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
    await new Promise((r) => setTimeout(r, 1500))
  }
  return false
}

async function ensureZone(name: string) {
  const existing = await prisma.zone.findFirst({ where: { name } })
  if (existing) {
    if (!existing.active) {
      return prisma.zone.update({
        where: { id: existing.id },
        data: { active: true },
      })
    }
    return existing
  }
  return prisma.zone.create({ data: { name, active: true } })
}

async function ensureCorridor(zoneAId: string, zoneBId: string) {
  const { zoneAId: a, zoneBId: b } = canonicalZonePair(zoneAId, zoneBId)
  for (const vehicleType of ["sedan", "minivan"] as const) {
    const existing = await prisma.interZoneFare.findFirst({
      where: { zoneAId: a, zoneBId: b, vehicleType },
    })
    if (!existing) {
      await prisma.interZoneFare.create({
        data: {
          zoneAId: a,
          zoneBId: b,
          vehicleType,
          baseFare: vehicleType === "sedan" ? 90 : 120,
          minFare: vehicleType === "sedan" ? 90 : 120,
          currency: "EUR",
          active: true,
        },
      })
    } else if (!existing.active) {
      await prisma.interZoneFare.update({
        where: { id: existing.id },
        data: { active: true },
      })
    }
  }
}

/**
 * Mirrors hero onFromChange: picking the current To swaps ends.
 */
function simulatePickFrom(
  places: BookingPlaceOption[],
  fromKey: string,
  toKey: string,
  pickKey: string,
  neighborMap: Map<string, Set<string>>,
) {
  const from = places.find((p) => p.key === pickKey)
  if (!from) return null
  if (pickKey === toKey) {
    const currentFrom = places.find((p) => p.key === fromKey)
    if (!currentFrom) return null
    return deriveRouteFromPlaces(from, currentFrom, neighborMap)
  }
  const to = places.find((p) => p.key === toKey)
  if (!to) return null
  return deriveRouteFromPlaces(from, to, neighborMap)
}

async function main() {
  console.log(`\nQA place swap (pick opposite city) @ ${base}\n`)

  // ---------------------------------------------------------------------------
  // A — Source wiring
  // ---------------------------------------------------------------------------
  const hero = read("components/marketing/hero-booking-card.tsx")
  const placesLib = read("lib/booking-places.ts")
  const routeStep = read("components/booking/steps/RouteStep.tsx")

  if (
    placesLib.includes("oppositePlace") &&
    placesLib.includes("filtered.push(oppositePlace)")
  ) {
    pass("A1 filter includes opposite for swap")
  } else {
    fail("A1 filter includes opposite for swap")
  }

  if (
    hero.includes("Picking the current To → swap") &&
    hero.includes("applyPlaces(from, currentFrom)")
  ) {
    pass("A2 hero onFromChange swap-on-pick")
  } else {
    fail("A2 hero onFromChange swap-on-pick")
  }

  if (
    hero.includes("Picking the current From → swap") &&
    hero.includes("applyPlaces(currentTo, to)")
  ) {
    pass("A3 hero onToChange swap-on-pick")
  } else {
    fail("A3 hero onToChange swap-on-pick")
  }

  if (
    routeStep.includes("Picking the current To → swap") &&
    routeStep.includes("applyPlaces(from, currentFrom)")
  ) {
    pass("A4 RouteStep swap-on-pick")
  } else {
    fail("A4 RouteStep swap-on-pick")
  }

  // ---------------------------------------------------------------------------
  // B — Unit: filter + derive swap (Ksamil ↔ Tirana City)
  // ---------------------------------------------------------------------------
  const ksamil = await ensureZone("Ksamil")
  const tiranaCity = await ensureZone("Tirana City")
  await ensureCorridor(ksamil.id, tiranaCity.id)
  pass("B1 fixtures", `${ksamil.name} ↔ ${tiranaCity.name}`)

  const places = buildPlaceOptions(
    [],
    [
      { id: ksamil.id, name: ksamil.name },
      { id: tiranaCity.id, name: tiranaCity.name },
      { id: "other-zone", name: "Other City" },
    ],
  )
  const neighborMap = buildCorridorNeighborMap([
    canonicalZonePair(ksamil.id, tiranaCity.id),
  ])

  const sedanOnlyMap = buildCorridorNeighborMap(
    [
      {
        ...canonicalZonePair(ksamil.id, tiranaCity.id),
        vehicleTypes: ["sedan"],
      },
    ],
    "minivan",
  )
  if (!sedanOnlyMap.get(ksamil.id)?.has(tiranaCity.id)) {
    pass("B1b vehicle filter hides corridor without matching fare")
  } else {
    fail("B1b vehicle filter hides corridor without matching fare")
  }
  const sedanMap = buildCorridorNeighborMap(
    [
      {
        ...canonicalZonePair(ksamil.id, tiranaCity.id),
        vehicleTypes: ["sedan"],
      },
    ],
    "sedan",
  )
  if (sedanMap.get(ksamil.id)?.has(tiranaCity.id)) {
    pass("B1c vehicle filter keeps corridor for matching vehicle")
  } else {
    fail("B1c vehicle filter keeps corridor for matching vehicle")
  }

  const ksamilKey = zonePlaceKey(ksamil.id)
  const tiranaKey = zonePlaceKey(tiranaCity.id)

  // From list when To = Tirana: must include Tirana (swap) + Ksamil (corridor)
  const fromOpts = filterPlacesForOppositeEnd(places, tiranaKey, neighborMap)
  const fromKeys = fromOpts.map((p) => p.key)
  if (fromKeys.includes(tiranaKey)) {
    pass("B2 From options include opposite (Tirana)")
  } else {
    fail("B2 From options include opposite (Tirana)", fromKeys.join(","))
  }
  if (fromKeys.includes(ksamilKey)) {
    pass("B3 From options include corridor neighbor (Ksamil)")
  } else {
    fail("B3 From options include corridor neighbor (Ksamil)", fromKeys.join(","))
  }
  if (!fromKeys.includes(zonePlaceKey("other-zone"))) {
    pass("B4 From options exclude unlinked city")
  } else {
    fail("B4 From options exclude unlinked city")
  }

  // Simulate: currently Ksamil → Tirana; user picks Tirana in From
  const swapped = simulatePickFrom(
    places,
    ksamilKey,
    tiranaKey,
    tiranaKey,
    neighborMap,
  )
  if (
    swapped &&
    swapped.direction === "zone_to_zone" &&
    swapped.selectedZoneId === tiranaCity.id &&
    swapped.selectedToZoneId === ksamil.id &&
    swapped.pickup.address === tiranaCity.name &&
    swapped.dropoff.address === ksamil.name
  ) {
    pass(
      "B5 pick Tirana in From swaps to Tirana→Ksamil",
      `${swapped.pickup.address} → ${swapped.dropoff.address}`,
    )
  } else {
    fail(
      "B5 pick Tirana in From swaps to Tirana→Ksamil",
      swapped
        ? `${swapped.pickup.address}→${swapped.dropoff.address} zone=${swapped.selectedZoneId}`
        : "null",
    )
  }

  // Reverse: Tirana → Ksamil; pick Ksamil in From → Ksamil → Tirana
  const swappedBack = simulatePickFrom(
    places,
    tiranaKey,
    ksamilKey,
    ksamilKey,
    neighborMap,
  )
  if (
    swappedBack &&
    swappedBack.selectedZoneId === ksamil.id &&
    swappedBack.selectedToZoneId === tiranaCity.id
  ) {
    pass(
      "B6 pick Ksamil in From swaps back",
      `${swappedBack.pickup.address} → ${swappedBack.dropoff.address}`,
    )
  } else {
    fail("B6 pick Ksamil in From swaps back")
  }

  // To-side: currently Ksamil → Tirana; picking Ksamil in To swaps via
  // applyPlaces(currentTo=Tirana, picked=Ksamil) → Tirana → Ksamil
  const toOpts = filterPlacesForOppositeEnd(places, ksamilKey, neighborMap)
  if (toOpts.some((p) => p.key === ksamilKey)) {
    pass("B7 To options include opposite (Ksamil)")
  } else {
    fail("B7 To options include opposite (Ksamil)")
  }

  const viaToPick = deriveRouteFromPlaces(
    places.find((p) => p.key === tiranaKey)!,
    places.find((p) => p.key === ksamilKey)!,
    neighborMap,
  )
  if (
    viaToPick?.selectedZoneId === tiranaCity.id &&
    viaToPick?.selectedToZoneId === ksamil.id
  ) {
    pass("B8 To-side swap logic Tirana→Ksamil")
  } else {
    fail("B8 To-side swap logic Tirana→Ksamil")
  }

  const same = places.find((p) => p.key === tiranaKey)!
  if (!deriveRouteFromPlaces(same, same, neighborMap)) {
    pass("B9 same-place still rejected")
  } else {
    fail("B9 same-place still rejected")
  }

  // ---------------------------------------------------------------------------
  // C — HTTP quotes both directions (live pricing)
  // ---------------------------------------------------------------------------
  if (!(await waitForApp())) {
    fail("C0 app reachable", `timed out ${base}`)
  } else {
    pass("C0 app reachable", base)

    const q1 = await fetch(`${base}/api/pricing/quote`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "ngrok-skip-browser-warning": "true",
      },
      body: JSON.stringify({
        direction: "zone_to_zone",
        vehicleType: "sedan",
        zoneId: ksamil.id,
        toZoneId: tiranaCity.id,
      }),
    })
    const b1 = await q1.json().catch(() => ({}))
    if (q1.status === 200 && Number(b1.price) > 0) {
      pass("C1 quote Ksamil→Tirana", `€${b1.price}`)
    } else {
      fail("C1 quote Ksamil→Tirana", `${q1.status} ${b1.error || ""}`)
    }

    const q2 = await fetch(`${base}/api/pricing/quote`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "ngrok-skip-browser-warning": "true",
      },
      body: JSON.stringify({
        direction: "zone_to_zone",
        vehicleType: "sedan",
        zoneId: tiranaCity.id,
        toZoneId: ksamil.id,
      }),
    })
    const b2 = await q2.json().catch(() => ({}))
    if (q2.status === 200 && Number(b2.price) > 0) {
      pass("C2 quote Tirana→Ksamil (after swap)", `€${b2.price}`)
    } else {
      fail("C2 quote Tirana→Ksamil (after swap)", `${q2.status} ${b2.error || ""}`)
    }

    if (
      q1.status === 200 &&
      q2.status === 200 &&
      Number(b1.price) === Number(b2.price)
    ) {
      pass("C3 corridor fare symmetric both ways", `€${b1.price}`)
    } else if (q1.status === 200 && q2.status === 200) {
      fail(
        "C3 corridor fare symmetric both ways",
        `${b1.price} vs ${b2.price}`,
      )
    }

    const config = await fetch(`${base}/api/booking/config`, {
      headers: { "ngrok-skip-browser-warning": "true" },
    })
    const cfg = await config.json().catch(() => ({}))
    const pairs = (cfg.cityCorridors ?? []) as {
      zoneAId: string
      zoneBId: string
      vehicleTypes?: string[]
    }[]
    const linked = pairs.find(
      (p) =>
        (p.zoneAId === ksamil.id && p.zoneBId === tiranaCity.id) ||
        (p.zoneAId === tiranaCity.id && p.zoneBId === ksamil.id),
    )
    if (config.status === 200 && linked) {
      const types = linked.vehicleTypes ?? []
      if (types.includes("sedan") || types.includes("minivan") || types.length === 0) {
        pass(
          "C4 config exposes Ksamil↔Tirana corridor with vehicleTypes",
          types.length ? types.join(",") : "(legacy empty)",
        )
      } else {
        fail(
          "C4 config exposes Ksamil↔Tirana corridor with vehicleTypes",
          `unexpected vehicleTypes: ${JSON.stringify(types)}`,
        )
      }
    } else {
      fail("C4 config exposes Ksamil↔Tirana corridor", `HTTP ${config.status}`)
    }
  }

  const fails = printSummary()
  await prisma.$disconnect()
  process.exit(fails > 0 ? 1 : 0)
}

main().catch(async (err) => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
})
