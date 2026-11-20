import { prisma } from "@/lib/db"

/** Recalculate driver.avgRating from approved reviews only (driverRating). */
export async function recalculateDriverAvgRating(driverId: string): Promise<number> {
  const agg = await prisma.review.aggregate({
    where: { driverId, status: "approved" },
    _avg: { driverRating: true },
    _count: { _all: true },
  })

  const avg =
    agg._count._all > 0 && agg._avg.driverRating != null
      ? Math.round(agg._avg.driverRating * 10) / 10
      : 0

  await prisma.driver.update({
    where: { id: driverId },
    data: { avgRating: avg },
  })

  return avg
}

export function serializePublicReview(review: {
  id: string
  driverRating: number
  driverComment: string | null
  platformRating: number
  platformComment: string | null
  createdAt: Date
  driver: { name: string; avgRating: number }
  booking: {
    dropoffAddress: string
    pickupAddress: string
    customer: { name: string }
  }
}) {
  const comment =
    review.platformComment?.trim() ||
    review.driverComment?.trim() ||
    null
  const customerName = review.booking.customer.name.trim()
  const firstName = customerName.split(/\s+/)[0] || "Guest"

  return {
    id: review.id,
    driverName: review.driver.name,
    driverRating: review.driverRating,
    platformRating: review.platformRating,
    comment,
    customerFirstName: firstName,
    routeLabel: `${review.booking.pickupAddress} → ${review.booking.dropoffAddress}`,
    dropoffAddress: review.booking.dropoffAddress,
    createdAt: review.createdAt.toISOString(),
  }
}

export type PublicReviewItem = ReturnType<typeof serializePublicReview>

export async function listPublicReviews(options?: {
  destination?: string
  limit?: number
}): Promise<PublicReviewItem[]> {
  const destination = options?.destination?.trim() ?? ""
  const limit = Math.min(24, Math.max(1, options?.limit ?? 6))

  const reviews = await prisma.review.findMany({
    where: {
      status: "approved",
      ...(destination
        ? {
            booking: {
              OR: [
                {
                  dropoffAddress: {
                    contains: destination,
                    mode: "insensitive",
                  },
                },
                {
                  pickupAddress: {
                    contains: destination,
                    mode: "insensitive",
                  },
                },
              ],
            },
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      driver: { select: { name: true, avgRating: true } },
      booking: {
        select: {
          pickupAddress: true,
          dropoffAddress: true,
          customer: { select: { name: true } },
        },
      },
    },
  })

  return reviews.map(serializePublicReview)
}
