import { NextResponse } from "next/server"

import { clientIpFromRequest } from "@/lib/client-ip"
import { prisma } from "@/lib/db"
import { takeRateLimit } from "@/lib/rate-limit"
import { serializePublicReview } from "@/lib/reviews"

const PUBLIC_REVIEWS_LIMIT = 60
const PUBLIC_REVIEWS_WINDOW_MS = 60 * 1000

/** Public approved reviews for marketing / testimonials. */
export async function GET(request: Request) {
  const ip = clientIpFromRequest(request)
  const limited = takeRateLimit(
    `reviews-public:${ip}`,
    PUBLIC_REVIEWS_LIMIT,
    PUBLIC_REVIEWS_WINDOW_MS,
  )
  if (!limited.ok) {
    return NextResponse.json(
      { error: `Too many requests. Try again in ${limited.retryAfterSec}s.` },
      {
        status: 429,
        headers: { "Retry-After": String(limited.retryAfterSec) },
      },
    )
  }

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
