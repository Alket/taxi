/**
 * QA: city corridor booking (Sarandë ↔ Tirana City / TIA).
 *
 * Covers quote + public book for airport vs city corridors, swap symmetry,
 * same-place reject, missing fare reject, and flight optional on city↔city.
 *
 * Run: npm run test:city-corridors
 * Docker: docker compose -f docker-compose.dev.yml exec -T app npm run test:city-corridors
 */
import { randomBytes } from "crypto"
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
function printSummary() {
  const fails = results.filter((r) => r.status === "FAIL").length
  const passes = results.filter((r) => r.status === "PASS").length
  console.log(`\n${passes} PASS / ${fails} FAIL (${results.length} checks)\n`)
  return fails
}
function uniq(tag: string) {
  return `${tag}${Date.now().toString(36)}${randomBytes(2).toString("hex")}`
}
function pickupIsoHoursFromNow(hours: number) {
  return new Date(Date.now() + hours * 3600_000).toISOString()
}
function read(rel: string) {
  return readFileSync(resolve(rel), "utf8")
}

async function waitForApp(timeoutMs = 90_000) {
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

async function ensureZonesAndCorridor() {
  const ensureZone = async (name: string) => {
    const existing = await prisma.zone.findFirst({ where: { name } })
    if (existing) {
      if (!existing.active) {
        await prisma.zone.update({
          where: { id: existing.id },
          data: { active: true },
        })
      }
      return existing
    }
    return prisma.zone.create({ data: { name, active: true } })
  }

  const sarande = await ensureZone("Sarandë")
  const tiranaCity = await ensureZone("Tirana City")

  // Ensure airport pricing exists for Sarandë (TIA corridor).
  for (const vehicleType of ["sedan", "minivan"] as const) {
    const rule = await prisma.pricingRule.findFirst({
      where: { zoneId: sarande.id, vehicleType },
    })
    if (!rule) {
      await prisma.pricingRule.create({
        data: {
          zoneId: sarande.id,
          vehicleType,
          baseFare: vehicleType === "sedan" ? 160 : 200,
          perKmRate: 1,
          minFare: vehicleType === "sedan" ? 160 : 200,
          currency: "EUR",
          active: true,
        },
      })
    } else if (!rule.active) {
      await prisma.pricingRule.update({
        where: { id: rule.id },
        data: { active: true },
      })
    }
  }

  const [zoneAId, zoneBId] =
    sarande.id < tiranaCity.id
      ? [sarande.id, tiranaCity.id]
      : [tiranaCity.id, sarande.id]

  for (const vehicleType of ["sedan", "minivan"] as const) {
    const fare = await prisma.interZoneFare.findUnique({
      where: {
        zoneAId_zoneBId_vehicleType: {
          zoneAId,
          zoneBId,
          vehicleType,
        },
      },
    })
    if (!fare) {
      await prisma.interZoneFare.create({
        data: {
          zoneAId,
          zoneBId,
          vehicleType,
          baseFare: vehicleType === "sedan" ? 180 : 220,
          minFare: vehicleType === "sedan" ? 180 : 220,
          currency: "EUR",
          active: true,
        },
      })
    } else if (!fare.active) {
      await prisma.interZoneFare.update({
        where: { id: fare.id },
        data: { active: true },
      })
    }
  }

  return { sarande, tiranaCity }
}

async function quote(body: Record<string, unknown>) {
  const res = await fetch(`${base}/api/pricing/quote`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "ngrok-skip-browser-warning": "true",
    },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  return { res, data }
}

async function createPublicBooking(body: Record<string, unknown>) {
  const res = await fetch(`${base}/api/bookings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "ngrok-skip-browser-warning": "true",
    },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  return { res, data }
}

async function main() {
  console.log("QA city corridors @", base)

  // Static wiring checks
  const schema = read("prisma/schema.prisma")
  if (schema.includes("zone_to_zone") && schema.includes("model InterZoneFare")) {
    pass("schema", "zone_to_zone + InterZoneFare")
  } else {
    fail("schema", "missing zone_to_zone or InterZoneFare")
  }

  const routeStep = read("components/booking/steps/RouteStep.tsx")
  if (
    routeStep.includes("deriveRouteFromPlaces") &&
    routeStep.includes("From") &&
    routeStep.includes("To")
  ) {
    pass("route-ui", "From/To place pickers")
  } else {
    fail("route-ui", "RouteStep missing From/To")
  }

  const pricingView = read("components/pricing/pricing-view.tsx")
  if (pricingView.includes("CityCorridorsPanel")) {
    pass("admin-fares-ui", "City corridors panel present")
  } else {
    fail("admin-fares-ui", "CityCorridorsPanel missing")
  }

  const hero = read("components/marketing/hero-booking-card.tsx")
  if (
    hero.includes("buildPlaceOptions") &&
    hero.includes("deriveRouteFromPlaces") &&
    hero.includes("zone_to_zone") &&
    hero.includes("toZoneId")
  ) {
    pass("hero-ui", "From/To places + zone_to_zone quotes")
  } else {
    fail("hero-ui", "Hero missing place-based corridor wiring")
  }

  const storeSrc = read("lib/store/booking-store.ts")
  if (storeSrc.includes("selectedToZoneId: state.selectedToZoneId")) {
    pass("persist-to-zone", "selectedToZoneId persisted")
  } else {
    fail("persist-to-zone", "selectedToZoneId missing from partialize")
  }

  const emails = read("lib/emails/booking-events.ts")
  if (
    emails.includes("DIRECTION_LABELS") &&
    emails.includes("Direction") &&
    emails.includes("direction: true")
  ) {
    pass("emails-direction", "Customer/admin emails include Direction")
  } else {
    fail("emails-direction", "Emails missing Direction label wiring")
  }

  const myBooking = read("components/booking/my-booking-view.tsx")
  if (
    myBooking.includes("directionLabel") &&
    (myBooking.includes("flightNumber &&") ||
      myBooking.includes("booking.flightNumber &&"))
  ) {
    pass("my-booking-ui", "Route + conditional flight")
  } else {
    fail("my-booking-ui", "My booking missing corridor display")
  }

  const confirmPage = read(
    "app/(booking)/book/confirmation/[referenceCode]/page.tsx",
  )
  const en = read("messages/en.json")
  if (
    confirmPage.includes("confirm.dirCityToCity") &&
    en.includes("confirm.dirCityToCity")
  ) {
    pass("confirm-i18n", "City → City confirmation label")
  } else {
    fail("confirm-i18n", "Missing confirm.dirCityToCity")
  }

  if (
    routeStep.includes("heroRouteLabels") ||
    (routeStep.includes("startedFromHero") &&
      routeStep.includes("ArrowRight"))
  ) {
    pass("book-route-summary", "Hero handoff shows From→To summary")
  } else {
    fail("book-route-summary", "RouteStep missing hero route summary")
  }

  if (!(await waitForApp())) {
    fail("app-up", `App not reachable at ${base}`)
    printSummary()
    process.exit(1)
  }
  pass("app-up", base)

  const { sarande, tiranaCity } = await ensureZonesAndCorridor()
  pass(
    "zones-ready",
    `Sarandë=${sarande.id.slice(0, 8)}… Tirana City=${tiranaCity.id.slice(0, 8)}…`,
  )

  // Quote: Sarandë → TIA (airport corridor via dest_to_airport)
  {
    const { res, data } = await quote({
      direction: "dest_to_airport",
      vehicleType: "sedan",
      zoneId: sarande.id,
    })
    if (res.ok && typeof data.price === "number" && data.price > 0) {
      pass("quote-sarande-tia", `price=${data.price}`)
    } else {
      fail("quote-sarande-tia", `${res.status} ${JSON.stringify(data)}`)
    }
  }

  // Quote: Sarandë → Tirana City
  let cityPrice = 0
  {
    const { res, data } = await quote({
      direction: "zone_to_zone",
      vehicleType: "sedan",
      zoneId: sarande.id,
      toZoneId: tiranaCity.id,
    })
    if (res.ok && typeof data.price === "number" && data.price > 0) {
      cityPrice = data.price
      pass("quote-sarande-tirana-city", `price=${data.price}`)
    } else {
      fail(
        "quote-sarande-tirana-city",
        `${res.status} ${JSON.stringify(data)}`,
      )
    }
  }

  // Swap: Tirana City → Sarandë same price
  {
    const { res, data } = await quote({
      direction: "zone_to_zone",
      vehicleType: "sedan",
      zoneId: tiranaCity.id,
      toZoneId: sarande.id,
    })
    if (
      res.ok &&
      typeof data.price === "number" &&
      cityPrice > 0 &&
      data.price === cityPrice
    ) {
      pass("quote-swap-symmetric", `price=${data.price}`)
    } else {
      fail(
        "quote-swap-symmetric",
        `expected ${cityPrice}, got ${res.status} ${JSON.stringify(data)}`,
      )
    }
  }

  // Same place reject
  {
    const { res, data } = await quote({
      direction: "zone_to_zone",
      vehicleType: "sedan",
      zoneId: sarande.id,
      toZoneId: sarande.id,
    })
    if (!res.ok) {
      pass("quote-same-place-reject", `${res.status}`)
    } else {
      fail("quote-same-place-reject", `unexpected ok ${JSON.stringify(data)}`)
    }
  }

  // Missing corridor reject (use a pair without fare if we can find one)
  {
    let other = await prisma.zone.findFirst({
      where: {
        active: true,
        id: { notIn: [sarande.id, tiranaCity.id] },
        name: { notIn: ["Sarandë", "Tirana City"] },
      },
    })
    if (!other) {
      other = await prisma.zone.create({
        data: { name: `QA Corridor Gap ${uniq("")}`, active: true },
      })
    }
    // Ensure no inter-zone fare for sarande ↔ other
    const [a, b] =
      sarande.id < other.id
        ? [sarande.id, other.id]
        : [other.id, sarande.id]
    await prisma.interZoneFare.deleteMany({
      where: { zoneAId: a, zoneBId: b },
    })

    const { res, data } = await quote({
      direction: "zone_to_zone",
      vehicleType: "sedan",
      zoneId: sarande.id,
      toZoneId: other.id,
    })
    if (
      !res.ok &&
      (String(data.error || "").toLowerCase().includes("no fare") ||
        data.code === "OUTSIDE_SERVICE_AREA")
    ) {
      pass("quote-missing-fare-reject", String(data.error || res.status))
    } else {
      fail(
        "quote-missing-fare-reject",
        `${res.status} ${JSON.stringify(data)}`,
      )
    }
  }

  const pickup = pickupIsoHoursFromNow(48)

  // Book Sarandë → TIA (flight required)
  {
    const email = `${uniq("tia")}@example.com`
    const { res, data } = await createPublicBooking({
      customer: {
        name: "QA TIA Corridor",
        email,
        phone: "+355691000001",
      },
      direction: "dest_to_airport",
      pickupAddress: "Sarandë",
      pickupLat: 39.8756,
      pickupLng: 20.005,
      dropoffAddress: "Tirana International (TIA)",
      dropoffLat: 41.4147,
      dropoffLng: 19.7206,
      pickupDateTime: pickup,
      flightNumber: "LH1445",
      passengerCount: 2,
      luggageCount: 2,
      vehicleType: "sedan",
      zoneId: sarande.id,
      isRoundTrip: false,
      meetAndGreet: false,
    })
    if (res.ok && data.bookingId) {
      pass("book-sarande-tia", data.referenceCode || data.bookingId)
      await prisma.booking
        .delete({ where: { id: data.bookingId } })
        .catch(() => {})
    } else {
      fail("book-sarande-tia", `${res.status} ${JSON.stringify(data)}`)
    }
  }

  // Airport book without flight should fail
  {
    const { res, data } = await createPublicBooking({
      customer: {
        name: "QA No Flight",
        email: `${uniq("nofly")}@example.com`,
        phone: "+355691000002",
      },
      direction: "dest_to_airport",
      pickupAddress: "Sarandë",
      pickupLat: 39.8756,
      pickupLng: 20.005,
      dropoffAddress: "Tirana International (TIA)",
      dropoffLat: 41.4147,
      dropoffLng: 19.7206,
      pickupDateTime: pickup,
      flightNumber: null,
      passengerCount: 1,
      luggageCount: 1,
      vehicleType: "sedan",
      zoneId: sarande.id,
      isRoundTrip: false,
      meetAndGreet: false,
    })
    if (!res.ok) {
      pass("book-airport-flight-required", `${res.status}`)
    } else {
      fail(
        "book-airport-flight-required",
        `unexpected ok ${JSON.stringify(data)}`,
      )
      if (data.bookingId) {
        await prisma.booking.delete({ where: { id: data.bookingId } }).catch(() => {})
      }
    }
  }

  // Book Sarandë → Tirana City without flight
  {
    const email = `${uniq("city")}@example.com`
    const { res, data } = await createPublicBooking({
      customer: {
        name: "QA City Corridor",
        email,
        phone: "+355691000003",
      },
      direction: "zone_to_zone",
      pickupAddress: "Sarandë",
      pickupLat: 39.8756,
      pickupLng: 20.005,
      dropoffAddress: "Tirana City",
      dropoffLat: 41.3275,
      dropoffLng: 19.8187,
      pickupDateTime: pickup,
      flightNumber: null,
      passengerCount: 2,
      luggageCount: 2,
      vehicleType: "sedan",
      zoneId: sarande.id,
      toZoneId: tiranaCity.id,
      isRoundTrip: false,
      meetAndGreet: false,
    })
    if (res.ok && data.bookingId) {
      const booking = await prisma.booking.findUnique({
        where: { id: data.bookingId },
      })
      if (
        booking &&
        booking.direction === "zone_to_zone" &&
        booking.toZoneId === tiranaCity.id &&
        booking.zoneId === sarande.id
      ) {
        pass("book-sarande-tirana-city-no-flight", data.referenceCode)
      } else {
        fail(
          "book-sarande-tirana-city-no-flight",
          `bad booking row ${JSON.stringify(booking)}`,
        )
      }
      await prisma.booking
        .delete({ where: { id: data.bookingId } })
        .catch(() => {})
    } else {
      fail(
        "book-sarande-tirana-city-no-flight",
        `${res.status} ${JSON.stringify(data)}`,
      )
    }
  }

  // Swap book Tirana City → Sarandë
  {
    const { res, data } = await createPublicBooking({
      customer: {
        name: "QA City Swap",
        email: `${uniq("swap")}@example.com`,
        phone: "+355691000004",
      },
      direction: "zone_to_zone",
      pickupAddress: "Tirana City",
      pickupLat: 41.3275,
      pickupLng: 19.8187,
      dropoffAddress: "Sarandë",
      dropoffLat: 39.8756,
      dropoffLng: 20.005,
      pickupDateTime: pickup,
      passengerCount: 1,
      luggageCount: 1,
      vehicleType: "sedan",
      zoneId: tiranaCity.id,
      toZoneId: sarande.id,
      isRoundTrip: false,
      meetAndGreet: false,
    })
    if (res.ok && data.bookingId) {
      pass("book-tirana-city-sarande-swap", data.referenceCode)
      await prisma.booking
        .delete({ where: { id: data.bookingId } })
        .catch(() => {})
    } else {
      fail(
        "book-tirana-city-sarande-swap",
        `${res.status} ${JSON.stringify(data)}`,
      )
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
