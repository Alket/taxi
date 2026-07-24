import { NextResponse } from "next/server"
import { z } from "zod"

import { findBookingForLookup } from "@/lib/managed-booking"
import { prisma } from "@/lib/db"

const bodySchema = z.object({
  reference: z.string().min(1),
  email: z.string().email(),
  driverRating: z.coerce.number().int().min(1).max(5),
  platformRating: z.coerce.number().int().min(1).max(5),
  driverComment: z.string().max(2000).optional().nullable(),
  platformComment: z.string().max(2000).optional().nullable(),
})

/**
 * Submit one review per completed booking (reference + email auth).
 * Stored as pending until an admin approves.
 */
export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please provide valid ratings (1–5) for driver and platform." },
      { status: 400 },
    )
  }

  const {
    reference,
    email,
    driverRating,
    platformRating,
    driverComment,
    platformComment,
  } = parsed.data

  const booking = await findBookingForLookup(reference, email)
  if (!booking) {
    return NextResponse.json(
      { error: "We couldn't find a booking matching those details." },
      { status: 404 },
    )
  }

  if (booking.status !== "completed") {
    return NextResponse.json(
      { error: "Reviews are only available after the trip is completed." },
      { status: 409 },
    )
  }

  if (!booking.driverId) {
    return NextResponse.json(
      { error: "This trip has no assigned driver to review." },
      { status: 409 },
    )
  }

  const existing = await prisma.review.findUnique({
    where: { bookingId: booking.id },
    select: { id: true },
  })
  if (existing) {
    return NextResponse.json(
      { error: "A review has already been submitted for this booking." },
      { status: 409 },
    )
  }

  const review = await prisma.review.create({
    data: {
      bookingId: booking.id,
      driverId: booking.driverId,
      driverRating,
      platformRating,
      driverComment: driverComment?.trim() || null,
      platformComment: platformComment?.trim() || null,
      status: "pending",
    },
    select: {
      id: true,
      status: true,
      driverRating: true,
      platformRating: true,
      driver: { select: { name: true } },
    },
  })

  try {
    const { notifyAdminsNewReview } = await import("@/lib/push-notifications")
    notifyAdminsNewReview({
      referenceCode: booking.referenceCode,
      customerName: booking.customer.name,
      driverName: review.driver.name,
      driverRating: review.driverRating,
      platformRating: review.platformRating,
      bookingId: booking.id,
    })
  } catch {
    // never block review submit
  }

  try {
    const { notifyReviewSubmitted } = await import("@/lib/emails/booking-events")
    void notifyReviewSubmitted(review.id)
  } catch {
    // never block review submit
  }

  return NextResponse.json(
    { review: { id: review.id, status: review.status } },
    { status: 201 },
  )
}
