/**
 * QA: round-trip confirmation email content + customer scoping.
 *
 * Covers:
 * - One-way snapshot stays single-leg
 * - Round trip includes outbound + return routes and combined trip total
 * - Colliding roundTripId across customers does NOT leak foreign legs
 *
 * Run: npx tsx scripts/qa-roundtrip-email.ts
 */
import { randomBytes } from "crypto"

import { prisma } from "@/lib/db"
import { getConfirmationTripSnapshot } from "@/lib/emails/booking-events"

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

function check(c: string, ok: boolean, detail = "") {
  if (ok) pass(c, detail)
  else fail(c, detail)
}

function uniq(prefix: string) {
  return `${prefix}_${randomBytes(4).toString("hex")}`
}

async function createCustomer(label: string) {
  const email = `${uniq(`qa-rt-${label}`)}@example.com`
  return prisma.customer.create({
    data: {
      name: `QA RT ${label}`,
      email,
      phone: "+355600000001",
    },
  })
}

async function createLeg(input: {
  customerId: string
  roundTripId: string | null
  isRoundTrip: boolean
  direction: "airport_to_dest" | "dest_to_airport"
  pickupAddress: string
  dropoffAddress: string
  pickupDateTime: Date
  totalPrice: number
  depositPaid: number
  balanceDue: number
  notes?: string
}) {
  const referenceCode = `QA-${randomBytes(3).toString("hex").toUpperCase()}`
  const pickupPin = String(
    randomBytes(3).readUIntBE(0, 3) % 1_000_000,
  ).padStart(6, "0")

  return prisma.booking.create({
    data: {
      referenceCode,
      pickupPin,
      direction: input.direction,
      pickupAddress: input.pickupAddress,
      dropoffAddress: input.dropoffAddress,
      pickupDateTime: input.pickupDateTime,
      flightNumber: "",
      passengerCount: 2,
      luggageCount: 2,
      vehicleType: "sedan",
      totalPrice: input.totalPrice,
      depositAmount: input.depositPaid + input.balanceDue,
      depositPaid: input.depositPaid,
      balanceDue: input.balanceDue,
      paymentStatus: "deposit_paid",
      status: "confirmed",
      currency: "EUR",
      freeCancellationUntil: new Date(Date.now() + 24 * 60 * 60 * 1000),
      isRoundTrip: input.isRoundTrip,
      roundTripId: input.roundTripId,
      notes: input.notes ?? null,
      customerId: input.customerId,
    },
  })
}

async function main() {
  console.log("Round-trip confirmation email QA\n")

  const createdBookingIds: string[] = []
  const createdCustomerIds: string[] = []

  try {
    const customerA = await createCustomer("a")
    const customerB = await createCustomer("b")
    createdCustomerIds.push(customerA.id, customerB.id)

    // --- One-way ---
    const oneWay = await createLeg({
      customerId: customerA.id,
      roundTripId: null,
      isRoundTrip: false,
      direction: "airport_to_dest",
      pickupAddress: "TIA Airport QA OneWay",
      dropoffAddress: "Saranda Hotel QA OneWay",
      pickupDateTime: new Date(Date.now() + 48 * 60 * 60 * 1000),
      totalPrice: 55,
      depositPaid: 11,
      balanceDue: 44,
    })
    createdBookingIds.push(oneWay.id)

    const oneSnap = await getConfirmationTripSnapshot(oneWay.id)
    check("O1 one-way snapshot exists", Boolean(oneSnap))
    check("O2 one-way not round trip", oneSnap?.isRoundTrip === false)
    check("O3 one-way single leg", oneSnap?.legIds.length === 1)
    check(
      "O4 one-way total equals leg",
      oneSnap?.tripTotal === 55,
      `got ${oneSnap?.tripTotal}`,
    )
    check(
      "O5 one-way body has pickup",
      Boolean(oneSnap?.textBody.includes("TIA Airport QA OneWay")),
    )
    check(
      "O6 one-way body has no Round trip label",
      !oneSnap?.textBody.includes("Trip: Round trip"),
    )

    // --- Proper round trip for A ---
    const sharedId = `rtrip_QA_${randomBytes(4).toString("hex")}`
    const outboundAt = new Date(Date.now() + 72 * 60 * 60 * 1000)
    const returnAt = new Date(Date.now() + 96 * 60 * 60 * 1000)

    const outA = await createLeg({
      customerId: customerA.id,
      roundTripId: sharedId,
      isRoundTrip: true,
      direction: "airport_to_dest",
      pickupAddress: "TIA Airport QA Outbound A",
      dropoffAddress: "Ksamil Villa QA Outbound A",
      pickupDateTime: outboundAt,
      totalPrice: 60,
      depositPaid: 12,
      balanceDue: 48,
    })
    const retA = await createLeg({
      customerId: customerA.id,
      roundTripId: sharedId,
      isRoundTrip: true,
      direction: "dest_to_airport",
      pickupAddress: "Ksamil Villa QA Return A",
      dropoffAddress: "TIA Airport QA Return A",
      pickupDateTime: returnAt,
      totalPrice: 60,
      depositPaid: 12,
      balanceDue: 48,
    })
    createdBookingIds.push(outA.id, retA.id)

    const rtSnap = await getConfirmationTripSnapshot(outA.id)
    check("R1 round-trip snapshot exists", Boolean(rtSnap))
    check("R2 flagged as round trip", rtSnap?.isRoundTrip === true)
    check("R3 both legs loaded", rtSnap?.legIds.length === 2, `${rtSnap?.legIds.length}`)
    check(
      "R4 only customer A on legs",
      rtSnap?.customerIds.length === 1 &&
        rtSnap.customerIds[0] === customerA.id,
    )
    check(
      "R5 trip total is sum of both legs",
      rtSnap?.tripTotal === 120,
      `got ${rtSnap?.tripTotal}`,
    )
    check(
      "R6 paid is sum of both deposits",
      rtSnap?.depositPaid === 24,
      `got ${rtSnap?.depositPaid}`,
    )
    check(
      "R7 balance is sum of both balances",
      rtSnap?.balanceDue === 96,
      `got ${rtSnap?.balanceDue}`,
    )
    check(
      "R8 body includes outbound route",
      Boolean(rtSnap?.textBody.includes("TIA Airport QA Outbound A")) &&
        Boolean(rtSnap?.textBody.includes("Ksamil Villa QA Outbound A")),
    )
    check(
      "R9 body includes return route",
      Boolean(rtSnap?.textBody.includes("Ksamil Villa QA Return A")) &&
        Boolean(rtSnap?.textBody.includes("TIA Airport QA Return A")),
    )
    check(
      "R10 body includes both references",
      Boolean(rtSnap?.textBody.includes(outA.referenceCode)) &&
        Boolean(rtSnap?.textBody.includes(retA.referenceCode)),
    )
    check(
      "R11 body shows trip total 120",
      Boolean(rtSnap?.textBody.includes("Trip total:")) &&
        Boolean(rtSnap?.textBody.match(/Trip total:.*120/)),
      rtSnap?.textBody.match(/Trip total:.*$/m)?.[0] ?? "missing",
    )
    check(
      "R12 snapshot from return leg also both",
      (await getConfirmationTripSnapshot(retA.id))?.legIds.length === 2,
    )

    // --- Collision: customer B reuses same roundTripId ---
    const leak = await createLeg({
      customerId: customerB.id,
      roundTripId: sharedId,
      isRoundTrip: true,
      direction: "airport_to_dest",
      pickupAddress: "SECRET Leak Pickup B",
      dropoffAddress: "SECRET Leak Dropoff B",
      pickupDateTime: new Date(Date.now() + 80 * 60 * 60 * 1000),
      totalPrice: 999,
      depositPaid: 0,
      balanceDue: 999,
    })
    createdBookingIds.push(leak.id)

    const scoped = await getConfirmationTripSnapshot(outA.id)
    check(
      "S1 collision still two legs for A",
      scoped?.legIds.length === 2,
      `${scoped?.legIds.length}`,
    )
    check(
      "S2 foreign booking excluded",
      !scoped?.legIds.includes(leak.id),
    )
    check(
      "S3 secret pickup not in body",
      !scoped?.textBody.includes("SECRET Leak Pickup B"),
    )
    check(
      "S4 secret dropoff not in body",
      !scoped?.textBody.includes("SECRET Leak Dropoff B"),
    )
    check(
      "S5 trip total unchanged (no 999 leak)",
      scoped?.tripTotal === 120,
      `got ${scoped?.tripTotal}`,
    )
    check(
      "S6 B snapshot is B-only",
      (await getConfirmationTripSnapshot(leak.id))?.legIds.length === 1 &&
        (await getConfirmationTripSnapshot(leak.id))?.legIds[0] === leak.id,
    )
  } finally {
    if (createdBookingIds.length) {
      await prisma.notificationLog.deleteMany({
        where: { bookingId: { in: createdBookingIds } },
      })
      await prisma.booking.deleteMany({
        where: { id: { in: createdBookingIds } },
      })
    }
    if (createdCustomerIds.length) {
      await prisma.customer.deleteMany({
        where: { id: { in: createdCustomerIds } },
      })
    }
  }

  const failed = results.filter((r) => r.status === "FAIL").length
  const passed = results.filter((r) => r.status === "PASS").length
  console.log(`\n${passed} passed, ${failed} failed`)
  await prisma.$disconnect()
  process.exit(failed > 0 ? 1 : 0)
}

main().catch(async (error) => {
  console.error(error)
  await prisma.$disconnect()
  process.exit(1)
})
