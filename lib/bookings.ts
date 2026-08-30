import type {
  Booking,
  BookingDetail,
  BookingDriver,
  DriverCostHistoryItem,
  InternalNoteHistoryItem,
  PaymentRecord,
  StatusEvent,
} from "@/lib/types"
import type { Prisma } from "@prisma/client"

import {
  DRIVER_COST_HISTORY_LIMIT,
  driverCostHistorySelect,
} from "@/lib/driver-cost"
import {
  INTERNAL_NOTE_HISTORY_LIMIT,
  internalNoteHistorySelect,
} from "@/lib/internal-notes"

const bookingListInclude = {
  customer: true,
  driver: true,
} satisfies Prisma.BookingInclude

const bookingDetailInclude = {
  customer: true,
  driver: true,
  statusEvents: { orderBy: { timestamp: "asc" as const } },
  payments: { orderBy: { createdAt: "asc" as const } },
  internalNotesUpdatedBy: { select: { id: true, name: true } },
  internalNoteEvents: {
    orderBy: { createdAt: "desc" as const },
    take: INTERNAL_NOTE_HISTORY_LIMIT,
    select: internalNoteHistorySelect,
  },
  driverCostUpdatedBy: { select: { id: true, name: true } },
  driverCostEvents: {
    orderBy: { createdAt: "desc" as const },
    take: DRIVER_COST_HISTORY_LIMIT,
    select: driverCostHistorySelect,
  },
} satisfies Prisma.BookingInclude

export type BookingListRecord = Prisma.BookingGetPayload<{
  include: typeof bookingListInclude
}>

export type BookingDetailRecord = Prisma.BookingGetPayload<{
  include: typeof bookingDetailInclude
}>

function toNumber(value: Prisma.Decimal | number): number {
  return typeof value === "number" ? value : Number(value)
}

function serializeDriver(driver: BookingListRecord["driver"]): BookingDriver | null {
  if (!driver) return null
  return {
    name: driver.name,
    phone: driver.phone,
    plateNumber: driver.plateNumber,
  }
}

function serializeTimeline(
  events: BookingDetailRecord["statusEvents"],
): StatusEvent[] {
  return events.map((event) => ({
    status: event.status,
    timestamp: event.timestamp.toISOString(),
  }))
}

function serializePayments(
  payments: BookingDetailRecord["payments"],
): PaymentRecord[] {
  return payments.map((payment) => ({
    id: payment.id,
    type: payment.type,
    amount: toNumber(payment.amount),
    currency: payment.currency,
    status: payment.status,
    provider: payment.provider,
    externalId: payment.externalId,
    paidAt: payment.paidAt?.toISOString() ?? null,
    createdAt: payment.createdAt.toISOString(),
  }))
}

function serializeInternalNoteHistory(
  events: BookingDetailRecord["internalNoteEvents"],
): InternalNoteHistoryItem[] {
  return events.map((event) => ({
    id: event.id,
    action: event.action,
    actorName: event.actorName,
    actorId: event.actorId,
    previousText: event.previousText,
    nextText: event.nextText,
    createdAt: event.createdAt.toISOString(),
  }))
}

function serializeDriverCostHistory(
  events: BookingDetailRecord["driverCostEvents"],
): DriverCostHistoryItem[] {
  return events.map((event) => ({
    id: event.id,
    action: event.action,
    actorName: event.actorName,
    actorId: event.actorId,
    previousAmount:
      event.previousAmount == null ? null : toNumber(event.previousAmount),
    nextAmount: event.nextAmount == null ? null : toNumber(event.nextAmount),
    createdAt: event.createdAt.toISOString(),
  }))
}

function serializeBookingBase(
  booking: BookingListRecord | BookingDetailRecord,
): Booking {
  return {
    id: booking.id,
    referenceCode: booking.referenceCode,
    pickupPin: booking.pickupPin,
    direction: booking.direction,
    pickupAddress: booking.pickupAddress,
    dropoffAddress: booking.dropoffAddress,
    pickupDateTime: booking.pickupDateTime.toISOString(),
    flightNumber: booking.flightNumber,
    flightStatus: booking.flightStatus,
    passengerCount: booking.passengerCount,
    luggageCount: booking.luggageCount,
    vehicleType: booking.vehicleType,
    totalPrice: toNumber(booking.totalPrice),
    depositAmount: toNumber(booking.depositAmount),
    depositPaid: toNumber(booking.depositPaid),
    balanceDue: toNumber(booking.balanceDue),
    isBalanceCharged: booking.isBalanceCharged,
    balanceChargedAt: booking.balanceChargedAt?.toISOString() ?? null,
    balanceChargedBy: booking.balanceChargedBy ?? null,
    paymentStatus: booking.paymentStatus,
    status: booking.status,
    customer: {
      name: booking.customer.name,
      email: booking.customer.email,
      phone: booking.customer.phone,
    },
    driver: serializeDriver(booking.driver),
    driverId: booking.driverId,
    currency: booking.currency,
    freeCancellationUntil: booking.freeCancellationUntil.toISOString(),
    cancelledAt: booking.cancelledAt?.toISOString() ?? null,
    cancellationOutcome: booking.cancellationOutcome ?? null,
    createdAt: booking.createdAt.toISOString(),
    timeline:
      "statusEvents" in booking
        ? serializeTimeline(booking.statusEvents)
        : [],
    notes: booking.notes ?? undefined,
    bookedForOther: booking.bookedForOther,
    passengerName: booking.passengerName ?? null,
    passengerEmail: booking.passengerEmail ?? null,
    passengerPhone: booking.passengerPhone ?? null,
    passengerNoEmail: booking.passengerNoEmail,
    bookerRelation: booking.bookerRelation ?? null,
  }
}

export function serializeBookingListItem(booking: BookingListRecord): Booking {
  return serializeBookingBase(booking)
}

export function serializeBookingDetail(
  booking: BookingDetailRecord,
  opts?: { includeDriverCostHistory?: boolean },
): BookingDetail {
  return {
    ...serializeBookingBase(booking),
    timeline: serializeTimeline(booking.statusEvents),
    payments: serializePayments(booking.payments),
    internalNotes: booking.internalNotes ?? null,
    internalNotesUpdatedAt:
      booking.internalNotesUpdatedAt?.toISOString() ?? null,
    internalNotesUpdatedBy: booking.internalNotesUpdatedBy
      ? {
          id: booking.internalNotesUpdatedBy.id,
          name: booking.internalNotesUpdatedBy.name,
        }
      : null,
    internalNoteHistory: serializeInternalNoteHistory(
      booking.internalNoteEvents,
    ),
    driverCost:
      booking.driverCost == null ? null : toNumber(booking.driverCost),
    driverCostUpdatedAt: booking.driverCostUpdatedAt?.toISOString() ?? null,
    driverCostUpdatedBy: booking.driverCostUpdatedBy
      ? {
          id: booking.driverCostUpdatedBy.id,
          name: booking.driverCostUpdatedBy.name,
        }
      : null,
    driverCostHistory: opts?.includeDriverCostHistory
      ? serializeDriverCostHistory(booking.driverCostEvents)
      : [],
  }
}

export { bookingListInclude, bookingDetailInclude }

/** Driver-recorded cash collection (manual payment with cash external id). */
export function getDriverCashPaidEvent(
  booking: Pick<
    BookingDetail,
    "payments" | "balanceChargedAt" | "balanceChargedBy" | "isBalanceCharged"
  >,
): { timestamp: string; recordedBy: string | null } | null {
  const cashPayment = booking.payments.find(
    (payment) =>
      payment.provider === "manual" &&
      payment.externalId?.startsWith("cash:"),
  )

  if (cashPayment?.paidAt) {
    return {
      timestamp: cashPayment.paidAt,
      recordedBy: booking.balanceChargedBy,
    }
  }

  if (
    booking.isBalanceCharged &&
    booking.balanceChargedAt &&
    booking.balanceChargedBy &&
    booking.balanceChargedBy !== "admin" &&
    booking.balanceChargedBy !== "customer" &&
    !booking.balanceChargedBy.startsWith("admin:")
  ) {
    return {
      timestamp: booking.balanceChargedAt,
      recordedBy: booking.balanceChargedBy,
    }
  }

  return null
}
