import { prisma } from "@/lib/db"
import { sendCustomerFlightDelay } from "@/lib/emails/booking-events"
import { getSettings } from "@/lib/settings"
import type { FlightStatus } from "@/lib/types"

/**
 * Persist a flight status update and email the customer when a new delay
 * crosses the configured threshold.
 */
export async function recordBookingFlightStatus(input: {
  bookingId: string
  status: FlightStatus
  delayMinutes?: number
  source?: string
}): Promise<{ emailSent: boolean }> {
  const booking = await prisma.booking.findUnique({
    where: { id: input.bookingId },
  })
  if (!booking) {
    throw new Error("Booking not found")
  }

  const settings = await getSettings()
  const delayMinutes = input.delayMinutes ?? 0
  const previousStatus = booking.flightStatus

  await prisma.$transaction(async (tx) => {
    await tx.booking.update({
      where: { id: input.bookingId },
      data: { flightStatus: input.status },
    })
    await tx.flightStatusEvent.create({
      data: {
        bookingId: input.bookingId,
        flightNumber: booking.flightNumber || "UNKNOWN",
        status: input.status,
        delayMinutes: input.status === "delayed" ? delayMinutes : null,
        source: input.source || "system",
        scheduledAt: booking.pickupDateTime,
      },
    })
  })

  let emailSent = false
  if (
    input.status === "delayed" &&
    previousStatus !== "delayed" &&
    delayMinutes >= settings.flightDelayThresholdMinutes
  ) {
    const result = await sendCustomerFlightDelay(input.bookingId, {
      delayMinutes,
    })
    emailSent = result.sent
  }

  return { emailSent }
}
