import { prisma } from "@/lib/db"
import {
  DIRECTION_LABELS,
  PAYMENT_STATUS_LABELS,
  VEHICLE_LABELS,
} from "@/lib/format"
import { isBookingLockedForCancel } from "@/lib/booking-status"
import type { Direction, VehicleType } from "@/lib/types"

export async function findBookingForLookup(reference: string, email: string) {
  return prisma.booking.findFirst({
    where: {
      referenceCode: { equals: reference, mode: "insensitive" },
      customer: { email: { equals: email, mode: "insensitive" } },
    },
    include: {
      customer: { select: { name: true, email: true } },
      driver: {
        select: {
          name: true,
          vehicleMake: true,
          vehicleModel: true,
          plateNumber: true,
          whatsappNumber: true,
        },
      },
      statusEvents: { orderBy: { timestamp: "asc" } },
    },
  })
}

export type LookupBookingRecord = NonNullable<
  Awaited<ReturnType<typeof findBookingForLookup>>
>

export function serializeManagedBooking(booking: LookupBookingRecord) {
  // Self-service cancel until the driver has arrived; deposit is always forfeited.
  const cancellable = !isBookingLockedForCancel(booking.status)
  const editable =
    booking.status === "pending" || booking.status === "confirmed"

  return {
    id: booking.id,
    referenceCode: booking.referenceCode,
    pickupPin: booking.pickupPin,
    direction: booking.direction,
    directionLabel: DIRECTION_LABELS[booking.direction as Direction],
    pickupAddress: booking.pickupAddress,
    dropoffAddress: booking.dropoffAddress,
    pickupDateTime: booking.pickupDateTime.toISOString(),
    flightNumber: booking.flightNumber || null,
    flightStatus: booking.flightStatus,
    vehicleType: booking.vehicleType,
    vehicleLabel: VEHICLE_LABELS[booking.vehicleType as VehicleType],
    passengerCount: booking.passengerCount,
    luggageCount: booking.luggageCount,
    meetAndGreet: booking.meetAndGreet,
    isRoundTrip: booking.isRoundTrip,
    currency: booking.currency,
    totalPrice: Number(booking.totalPrice),
    depositAmount: Number(booking.depositAmount),
    depositPaid: Number(booking.depositPaid),
    balanceDue: Number(booking.balanceDue),
    status: booking.status,
    paymentStatus: booking.paymentStatus,
    paymentStatusLabel: PAYMENT_STATUS_LABELS[booking.paymentStatus],
    cancelledAt: booking.cancelledAt?.toISOString() ?? null,
    cancellationOutcome: booking.cancellationOutcome,
    cancellable,
    editable,
    customer: {
      name: booking.customer.name,
      email: booking.customer.email,
    },
    driver: booking.driver
      ? {
          name: booking.driver.name,
          vehicleMake: booking.driver.vehicleMake,
          vehicleModel: booking.driver.vehicleModel,
          plateNumber: booking.driver.plateNumber,
          whatsappUrl: booking.driver.whatsappNumber
            ? `https://wa.me/${booking.driver.whatsappNumber.replace(/\D/g, "")}`
            : null,
        }
      : null,
    timeline: booking.statusEvents.map((event) => ({
      status: event.status,
      timestamp: event.timestamp.toISOString(),
    })),
  }
}

export type ManagedBooking = ReturnType<typeof serializeManagedBooking>
