import { NextResponse } from "next/server"

import { prisma } from "@/lib/db"
import { serializePublicReview } from "@/lib/reviews"

/** Public approved reviews for marketing / testimonials. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const destination = searchParams.get("destination")?.trim() ?? ""
  const limit = Math.min(
    24,
    Math.max(1, Number(searchParams.get("limit") ?? "12") || 12),
  )

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

  return NextResponse.json({
    reviews: reviews.map(serializePublicReview),
  })
}
