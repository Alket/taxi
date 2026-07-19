import { randomBytes } from "crypto"
import { z } from "zod"

import {
  computeChildSeatTotal,
  formatChildSeatNotes,
  parseChildSeatCounts,
} from "@/lib/child-seats"
import { prisma } from "@/lib/db"
import {
  isPickupTooSoon,
  pickupLeadTimeMessage,
} from "@/lib/pickup-lead-time"
import {
  calculatePriceForZone,
  getActiveZone,
  type LatLng,
} from "@/lib/pricing"
import { getBookingPolicy } from "@/lib/settings"
import { computeTripTotal, round2 } from "@/lib/vehicles"

export const bookingCreateSchema = z.object({
  customer: z.object({
    name: z.string().min(1).max(200),
    email: z.string().email().max(320),
    phone: z.string().min(1).max(50),
    whatsappOptIn: z.boolean().optional().default(true),
  }),
  direction: z.enum(["airport_to_dest", "dest_to_airport"]),
  pickupAddress: z.string().min(1).max(400),
  pickupLat: z.coerce.number(),
  pickupLng: z.coerce.number(),
  dropoffAddress: z.string().min(1).max(400),
  dropoffLat: z.coerce.number(),
  dropoffLng: z.coerce.number(),
  pickupDateTime: z.string().min(1),
  returnDateTime: z.string().optional().nullable(),
  flightNumber: z.string().optional().nullable(),
  passengerCount: z.coerce.number().int().min(1).max(30),
  luggageCount: z.coerce.number().int().min(0).max(50),
  infantCarrierCount: z.coerce.number().int().min(0).max(4).optional().default(0),
  childSeatCount: z.coerce.number().int().min(0).max(4).optional().default(0),
  boosterCount: z.coerce.number().int().min(0).max(4).optional().default(0),
  driverNotes: z.string().trim().max(500).optional().nullable(),
  vehicleType: z.enum(["sedan", "comfort", "minivan", "premium"]),
  /** Active pricing zone selected as the non-airport destination. */
  zoneId: z.string().min(1),
  isRoundTrip: z.boolean().default(false),
  meetAndGreet: z.boolean().default(false),
  /** Admin manual bookings only — mark the full fare as already paid. */
  markAsPaid: z.boolean().optional().default(false),
  /**
   * Marks bookings created from the public /book flow as unpaid pending
   * checkouts. Admins should treat `paymentStatus=unpaid` + this note as
   * potentially abandoned until deposit is paid (periodic cleanup recommended).
   */
  source: z.enum(["admin", "public"]).optional().default("admin"),
})

export type BookingCreateInput = z.infer<typeof bookingCreateSchema>

function generateReferenceCode() {
  const v = randomBytes(3).toString("hex").toUpperCase()
  return `TRF-${v}`
}

function generatePickupPin() {
  // 6-digit numeric PIN (000000–999999), zero-padded.
  const n = randomBytes(3).readUIntBE(0, 3) % 1_000_000
  return String(n).padStart(6, "0")
}

async function generateUniqueReferenceCode(): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const code = generateReferenceCode()
    const exists = await prisma.booking.findUnique({
      where: { referenceCode: code },
      select: { id: true },
    })
    if (!exists) return code
  }
  throw new Error("Failed to generate a unique reference code.")
}

async function generateUniquePickupPin(): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const pin = generatePickupPin()
    const exists = await prisma.booking.findUnique({
      where: { pickupPin: pin },
      select: { id: true },
    })
    if (!exists) return pin
  }
  throw new Error("Failed to generate a unique pickup PIN.")
}

export type CreatedBookingSummary = {
  id: string
  referenceCode: string
  pickupPin: string
  depositAmount: number
  totalPrice: number
  balanceDue: number
  currency: string
  freeCancellationUntil: string
  freeCancellationHours: number
}

export async function createBookingsFromInput(
  input: BookingCreateInput,
): Promise<{ bookings: CreatedBookingSummary[] }> {
  const policy = await getBookingPolicy()
  const {
    currency,
    depositPercentage,
    freeCancellationHours,
    infantCarrierPrice,
    childSeatPrice,
    boosterSeatPrice,
  } = policy
  const seatPrices = {
    infantCarrierPrice,
    childSeatPrice,
    boosterSeatPrice,
  }
  const seatCounts = parseChildSeatCounts(input)
  const seatAddon = computeChildSeatTotal(seatCounts, seatPrices)
  const seatNotes = formatChildSeatNotes(seatCounts, seatPrices, currency)

  const settingsRow = await prisma.settings.findUnique({
    where: { id: "default" },
  })
  const roundTripDiscountPercent = settingsRow?.roundTripDiscountPercent ?? 0

  const pickupCoords: LatLng = { lat: input.pickupLat, lng: input.pickupLng }
  const dropoffCoords: LatLng = {
    lat: input.dropoffLat,
    lng: input.dropoffLng,
  }

  const emailNorm = input.customer.email.trim().toLowerCase()
  const customer = await prisma.customer.upsert({
    where: { email: emailNorm },
    update: { name: input.customer.name, phone: input.customer.phone },
    create: {
      name: input.customer.name,
      email: emailNorm,
      phone: input.customer.phone,
    },
  })

  const zone = await getActiveZone(input.zoneId)

  async function createLeg({
    direction,
    pickupAddress,
    pickup,
    dropoffAddress,
    dropoff,
    pickupDateTime,
    isRoundTrip,
    roundTripId,
    priceOverride,
  }: {
    direction: "airport_to_dest" | "dest_to_airport"
    pickupAddress: string
    pickup: LatLng
    dropoffAddress: string
    dropoff: LatLng
    pickupDateTime: Date
    isRoundTrip: boolean
    roundTripId: string | null
    priceOverride?: number
  }): Promise<CreatedBookingSummary> {
    const computedPrice = await calculatePriceForZone(
      zone.id,
      input.vehicleType,
    )
    // Round-trip overrides already include the seat add-on (split across legs).
    const totalPrice =
      priceOverride != null
        ? priceOverride
        : round2(computedPrice + seatAddon)

    const depositAmount = round2((totalPrice * depositPercentage) / 100)
    const balanceDue = round2(totalPrice - depositAmount)

    const freeCancellationUntil = new Date(
      pickupDateTime.getTime() - freeCancellationHours * 60 * 60 * 1000,
    )

    const referenceCode = await generateUniqueReferenceCode()
    const pickupPin = await generateUniquePickupPin()
    const flightNumber = input.flightNumber?.toString().trim() ?? ""

    const driverNotes = input.driverNotes?.trim() ?? ""

    const noteParts: string[] = []
    if (input.meetAndGreet) noteParts.push("Meet & greet requested.")
    if (seatNotes) noteParts.push(seatNotes)
    if (driverNotes) noteParts.push(`Driver notes: ${driverNotes}`)
    if (input.source === "public") {
      // Pending + unpaid from /book — may be abandoned if deposit never paid.
      noteParts.push(
        "Source: public booking · awaiting deposit (unpaid pending checkout).",
      )
    }
    if (input.customer.whatsappOptIn === false) {
      noteParts.push("Customer opted out of WhatsApp updates.")
    }

    const markAsPaid = input.source === "admin" && input.markAsPaid === true
    if (markAsPaid) {
      noteParts.push("Marked paid on admin create.")
    }

    const now = new Date()
    const booking = await prisma.booking.create({
      data: {
        referenceCode,
        pickupPin,
        direction,
        pickupAddress,
        dropoffAddress,
        pickupDateTime,
        flightNumber,
        passengerCount: input.passengerCount,
        luggageCount: input.luggageCount,
        vehicleType: input.vehicleType,
        totalPrice,
        depositAmount,
        depositPaid: markAsPaid ? totalPrice : 0,
        balanceDue: markAsPaid ? 0 : balanceDue,
        isBalanceCharged: markAsPaid,
        balanceChargedAt: markAsPaid ? now : undefined,
        balanceChargedBy: markAsPaid ? "admin:manual-create" : undefined,
        paymentStatus: markAsPaid ? "fully_paid" : "unpaid",
        status: "pending",
        currency,
        freeCancellationUntil,
        notes: noteParts.length > 0 ? noteParts.join(" ") : undefined,
        meetAndGreet: input.meetAndGreet,
        isRoundTrip,
        roundTripId,
        customerId: customer.id,
        zoneId: zone.id,
        statusEvents: {
          create: [{ status: "pending", timestamp: now }],
        },
        ...(markAsPaid
          ? {
              payments: {
                create: {
                  type: "balance",
                  amount: totalPrice,
                  currency,
                  status: "fully_paid",
                  provider: "manual",
                  externalId: `admin-create:${referenceCode}`,
                  paidAt: now,
                },
              },
            }
          : {}),
      },
      select: {
        id: true,
        referenceCode: true,
        pickupPin: true,
        depositAmount: true,
        totalPrice: true,
        balanceDue: true,
        currency: true,
        freeCancellationUntil: true,
      },
    })

    return {
      id: booking.id,
      referenceCode: booking.referenceCode,
      pickupPin: booking.pickupPin,
      depositAmount: Number(booking.depositAmount),
      totalPrice: Number(booking.totalPrice),
      balanceDue: Number(booking.balanceDue),
      currency: booking.currency,
      freeCancellationUntil: booking.freeCancellationUntil.toISOString(),
      freeCancellationHours,
    }
  }

  const pickupDateTime = new Date(input.pickupDateTime)
  if (Number.isNaN(pickupDateTime.getTime())) {
    throw new Error("Invalid pickupDateTime.")
  }

  if (input.source === "public" && isPickupTooSoon(pickupDateTime)) {
    throw new Error(pickupLeadTimeMessage())
  }

  const isRoundTrip = input.isRoundTrip
  const roundTripId = isRoundTrip ? `rtrip_${generateReferenceCode()}` : null

  const createdBookings: CreatedBookingSummary[] = []

  if (isRoundTrip) {
    const oneWay = await calculatePriceForZone(zone.id, input.vehicleType)
    const combined = round2(
      computeTripTotal(oneWay, true, roundTripDiscountPercent) + seatAddon,
    )
    // Split combined round-trip total evenly across both legs for ledger clarity.
    const legPrice = round2(combined / 2)

    const first = await createLeg({
      direction: input.direction,
      pickupAddress: input.pickupAddress,
      pickup: pickupCoords,
      dropoffAddress: input.dropoffAddress,
      dropoff: dropoffCoords,
      pickupDateTime,
      isRoundTrip,
      roundTripId,
      priceOverride: legPrice,
    })
    createdBookings.push(first)

    let returnPickupDateTime: Date
    if (input.returnDateTime) {
      returnPickupDateTime = new Date(input.returnDateTime)
      if (Number.isNaN(returnPickupDateTime.getTime())) {
        throw new Error("Invalid returnDateTime.")
      }
    } else {
      returnPickupDateTime = new Date(
        pickupDateTime.getTime() + 12 * 60 * 60 * 1000,
      )
    }

    const returnDirection =
      input.direction === "airport_to_dest"
        ? "dest_to_airport"
        : "airport_to_dest"

    const second = await createLeg({
      direction: returnDirection,
      pickupAddress: input.dropoffAddress,
      pickup: dropoffCoords,
      dropoffAddress: input.pickupAddress,
      dropoff: pickupCoords,
      pickupDateTime: returnPickupDateTime,
      isRoundTrip,
      roundTripId,
      priceOverride: legPrice,
    })
    createdBookings.push(second)
  } else {
    const first = await createLeg({
      direction: input.direction,
      pickupAddress: input.pickupAddress,
      pickup: pickupCoords,
      dropoffAddress: input.dropoffAddress,
      dropoff: dropoffCoords,
      pickupDateTime,
      isRoundTrip,
      roundTripId,
    })
    createdBookings.push(first)
  }

  // Staff browser push for admin-created bookings (public waits until paid).
  if (input.source === "admin" && createdBookings[0]) {
    const first = createdBookings[0]
    const { notifyAdminsNewBooking } = await import("@/lib/push-notifications")
    notifyAdminsNewBooking({
      bookingId: first.id,
      referenceCode: first.referenceCode,
      pickupAddress: input.pickupAddress,
      dropoffAddress: input.dropoffAddress,
      customerName: input.customer.name,
    })
  }

  return { bookings: createdBookings }
}
