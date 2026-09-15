import { randomBytes } from "crypto"
import { z } from "zod"

import {
  bookingCustomerEmailSchema,
  bookingCustomerNameSchema,
  bookingCustomerPhoneSchema,
  bookingFlightNumberSchema,
  bookingPassengerEmailSchema,
  bookingPassengerNameSchema,
  normalizeFlightNumber,
} from "@/lib/booking-details"
import {
  bookerRelationSchema,
  type BookerRelation,
} from "@/lib/booker-relation"
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
  calculatePriceForInterZone,
  calculatePriceForZone,
  getActiveZone,
  type LatLng,
} from "@/lib/pricing"
import {
  assertAddressesMatchPricedRoute,
  RouteAddressMismatchError,
} from "@/lib/route-address-guard"
import { getBookingPolicy, getSettings } from "@/lib/settings"
import {
  assertVehicleFitsParty,
  assertVehicleTypeEnabled,
  computeTripTotal,
  round2,
  vehicleCapacitiesFromSettingsRow,
  vehicleTypeSchema,
} from "@/lib/vehicles"

export const bookingCreateSchema = z
  .object({
    customer: z.object({
      name: bookingCustomerNameSchema,
      email: bookingCustomerEmailSchema,
      phone: bookingCustomerPhoneSchema,
      whatsappOptIn: z.boolean().optional().default(true),
    }),
    direction: z.enum(["airport_to_dest", "dest_to_airport", "zone_to_zone"]),
    pickupAddress: z.string().min(1).max(400),
    pickupLat: z.coerce.number(),
    pickupLng: z.coerce.number(),
    dropoffAddress: z.string().min(1).max(400),
    dropoffLat: z.coerce.number(),
    dropoffLng: z.coerce.number(),
    pickupDateTime: z.string().min(1),
    returnDateTime: z.string().optional().nullable(),
    flightNumber: bookingFlightNumberSchema,
    passengerCount: z.coerce.number().int().min(1).max(20),
    luggageCount: z.coerce.number().int().min(0).max(30),
    infantCarrierCount: z.coerce
      .number()
      .int()
      .min(0)
      .max(4)
      .optional()
      .default(0),
    childSeatCount: z.coerce.number().int().min(0).max(4).optional().default(0),
    boosterCount: z.coerce.number().int().min(0).max(4).optional().default(0),
    driverNotes: z.string().trim().max(500).optional().nullable(),
    vehicleType: vehicleTypeSchema,
    /** Active pricing zone: non-airport end, or pickup zone for zone_to_zone. */
    zoneId: z.string().min(1),
    /** Dropoff zone for zone_to_zone; omit for airport corridors. */
    toZoneId: z.string().min(1).optional().nullable(),
    /** IATA for airport↔zone legs — required on public airport corridors. */
    airportIata: z
      .string()
      .trim()
      .length(3)
      .optional()
      .nullable()
      .transform((v) => (v ? v.toUpperCase() : null)),
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
    bookedForOther: z.boolean().optional().default(false),
    passengerName: z.string().trim().max(80).optional().nullable(),
    passengerEmail: z.string().trim().max(320).optional().nullable(),
    passengerPhone: z.string().trim().max(50).optional().nullable(),
    passengerNoEmail: z.boolean().optional().default(false),
    bookerRelation: bookerRelationSchema.optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.direction === "zone_to_zone") {
      if (!data.toZoneId) {
        ctx.addIssue({
          code: "custom",
          path: ["toZoneId"],
          message: "Select a dropoff city.",
        })
      } else if (data.toZoneId === data.zoneId) {
        ctx.addIssue({
          code: "custom",
          path: ["toZoneId"],
          message: "Pickup and dropoff must be different cities.",
        })
      }
    } else if (data.source === "public" && !data.airportIata) {
      ctx.addIssue({
        code: "custom",
        path: ["airportIata"],
        message: "Select an airport.",
      })
    }

    if (data.source === "public" && data.direction !== "zone_to_zone") {
      const flight = (data.flightNumber ?? "").trim()
      if (!flight) {
        ctx.addIssue({
          code: "custom",
          path: ["flightNumber"],
          message: "Enter your flight number.",
        })
      }
    }

    if (!data.bookedForOther) return

    const name = bookingPassengerNameSchema.safeParse(data.passengerName ?? "")
    if (!name.success) {
      ctx.addIssue({
        code: "custom",
        path: ["passengerName"],
        message:
          name.error.issues[0]?.message ?? "Enter the passenger's full name.",
      })
    }

    if (!data.passengerNoEmail) {
      const email = bookingPassengerEmailSchema.safeParse(
        data.passengerEmail ?? "",
      )
      if (!email.success) {
        ctx.addIssue({
          code: "custom",
          path: ["passengerEmail"],
          message:
            email.error.issues[0]?.message ??
            "Enter a valid passenger email.",
        })
      }
    }

    const phone = bookingCustomerPhoneSchema.safeParse(
      data.passengerPhone ?? "",
    )
    if (!phone.success) {
      ctx.addIssue({
        code: "custom",
        path: ["passengerPhone"],
        message:
          phone.error.issues[0]?.message ??
          "Enter a valid passenger phone number.",
      })
    }

    if (!data.bookerRelation) {
      ctx.addIssue({
        code: "custom",
        path: ["bookerRelation"],
        message: "Select your relation with the passenger.",
      })
    }
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

async function generateUniqueRoundTripId(): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const id = `rtrip_${generateReferenceCode()}`
    const exists = await prisma.booking.findFirst({
      where: { roundTripId: id },
      select: { id: true },
    })
    if (!exists) return id
  }
  throw new Error("Failed to generate a unique round-trip id.")
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
  /** Null for unpaid public checkouts — PIN is revealed after payment / cash confirm. */
  pickupPin: string | null
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
    sedanSeats,
    sedanLuggage,
    minivanSeats,
    minivanLuggage,
    sedanEnabled,
    minivanEnabled,
  } = policy
  const vehicleCapacities = vehicleCapacitiesFromSettingsRow({
    sedanSeats,
    sedanLuggage,
    minivanSeats,
    minivanLuggage,
  })
  assertVehicleTypeEnabled({ sedanEnabled, minivanEnabled }, input.vehicleType)
  assertVehicleFitsParty(
    input.vehicleType,
    input.passengerCount,
    input.luggageCount,
    vehicleCapacities,
  )
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
  const toZone =
    input.direction === "zone_to_zone" && input.toZoneId
      ? await getActiveZone(input.toZoneId)
      : null

  if (input.source === "public") {
    const settings = await getSettings()
    let requiredAirport = null as (typeof settings.airports)[number] | null
    if (input.direction !== "zone_to_zone") {
      const iata = (input.airportIata ?? "").toUpperCase()
      requiredAirport =
        settings.airports.find((a) => a.iataCode.toUpperCase() === iata) ?? null
      if (!requiredAirport) {
        throw new RouteAddressMismatchError(
          "Select a valid airport for this route.",
        )
      }
    }
    assertAddressesMatchPricedRoute({
      direction: input.direction,
      pickupAddress: input.pickupAddress,
      dropoffAddress: input.dropoffAddress,
      fromZoneName: zone.name,
      toZoneName: toZone?.name ?? null,
      requiredAirport,
    })
  }

  async function priceForLeg(
    direction: "airport_to_dest" | "dest_to_airport" | "zone_to_zone",
    pickupZoneId: string,
    dropoffZoneId: string | null,
  ): Promise<number> {
    if (direction === "zone_to_zone" && dropoffZoneId) {
      return calculatePriceForInterZone(
        pickupZoneId,
        dropoffZoneId,
        input.vehicleType,
      )
    }
    return calculatePriceForZone(pickupZoneId, input.vehicleType)
  }

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
    legZoneId,
    legToZoneId,
  }: {
    direction: "airport_to_dest" | "dest_to_airport" | "zone_to_zone"
    pickupAddress: string
    pickup: LatLng
    dropoffAddress: string
    dropoff: LatLng
    pickupDateTime: Date
    isRoundTrip: boolean
    roundTripId: string | null
    priceOverride?: number
    legZoneId: string
    legToZoneId: string | null
  }): Promise<CreatedBookingSummary> {
    const computedPrice = await priceForLeg(
      direction,
      legZoneId,
      legToZoneId,
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
    const flightNumber = input.flightNumber
      ? normalizeFlightNumber(input.flightNumber)
      : ""

    const driverNotes = input.driverNotes?.trim() ?? ""

    const bookedForOther = Boolean(input.bookedForOther)
    const passengerName = bookedForOther
      ? (input.passengerName?.trim() || null)
      : null
    const passengerNoEmail = bookedForOther
      ? Boolean(input.passengerNoEmail)
      : false
    const passengerEmail =
      bookedForOther && !passengerNoEmail && input.passengerEmail?.trim()
        ? input.passengerEmail.trim().toLowerCase()
        : null
    const passengerPhone = bookedForOther
      ? (input.passengerPhone?.trim() || null)
      : null
    const bookerRelation: BookerRelation | null =
      bookedForOther && input.bookerRelation ? input.bookerRelation : null

    const noteParts: string[] = []
    if (input.meetAndGreet) {
      noteParts.push(
        passengerName
          ? `Meet & greet requested for ${passengerName}.`
          : "Meet & greet requested.",
      )
    }
    if (bookedForOther && passengerName) {
      noteParts.push(`Passenger: ${passengerName}.`)
    }
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

    // Admin /admin/bookings creates land Confirmed. Public /book stays Pending
    // until deposit/cash confirms (marketing checkouts must not skip that gate).
    const initialStatus =
      input.source === "admin" ? ("confirmed" as const) : ("pending" as const)

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
        status: initialStatus,
        currency,
        freeCancellationUntil,
        notes: noteParts.length > 0 ? noteParts.join(" ") : undefined,
        meetAndGreet: input.meetAndGreet,
        isRoundTrip,
        roundTripId,
        bookedForOther,
        passengerName,
        passengerEmail,
        passengerPhone,
        passengerNoEmail,
        bookerRelation,
        customerId: customer.id,
        zoneId: legZoneId,
        toZoneId: direction === "zone_to_zone" ? legToZoneId : null,
        statusEvents: {
          create: [{ status: initialStatus, timestamp: now }],
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
      // Never return PIN on unpaid public checkouts (create response is pre-payment).
      pickupPin:
        input.source === "public" && !markAsPaid ? null : booking.pickupPin,
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
  const roundTripId = isRoundTrip ? await generateUniqueRoundTripId() : null

  const createdBookings: CreatedBookingSummary[] = []

  if (isRoundTrip) {
    const oneWay = await priceForLeg(
      input.direction,
      zone.id,
      toZone?.id ?? null,
    )
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
      legZoneId: zone.id,
      legToZoneId: toZone?.id ?? null,
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
      input.direction === "zone_to_zone"
        ? "zone_to_zone"
        : input.direction === "airport_to_dest"
          ? "dest_to_airport"
          : "airport_to_dest"

    const returnZoneId =
      input.direction === "zone_to_zone" && toZone ? toZone.id : zone.id
    const returnToZoneId =
      input.direction === "zone_to_zone" ? zone.id : null

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
      legZoneId: returnZoneId,
      legToZoneId: returnToZoneId,
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
      legZoneId: zone.id,
      legToZoneId: toZone?.id ?? null,
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
    try {
      const { sendBookingConfirmationEmail } = await import(
        "@/lib/emails/booking-events"
      )
      await sendBookingConfirmationEmail(first.id)
    } catch {
      // never block create
    }
  }

  // Newer public checkout replaces older unpaid pending/abandoned ones.
  if (input.source === "public" && createdBookings.length > 0) {
    const { supersedeOlderPublicCheckouts } = await import(
      "@/lib/abandon-checkouts"
    )
    await supersedeOlderPublicCheckouts({
      customerId: customer.id,
      keepBookingIds: createdBookings.map((b) => b.id),
    })
  }

  return { bookings: createdBookings }
}
