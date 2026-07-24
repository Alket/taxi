import { NextResponse } from "next/server"
import type { ReviewStatus } from "@prisma/client"

import { getSession } from "@/lib/auth"
import { prisma } from "@/lib/db"

function serializeAdminReview(
  review: Awaited<ReturnType<typeof loadReviews>>[number],
) {
  return {
    id: review.id,
    status: review.status,
    driverRating: review.driverRating,
    driverComment: review.driverComment,
    platformRating: review.platformRating,
    platformComment: review.platformComment,
    createdAt: review.createdAt.toISOString(),
    moderatedAt: review.moderatedAt?.toISOString() ?? null,
    driver: {
      id: review.driver.id,
      name: review.driver.name,
      avgRating: review.driver.avgRating,
    },
    booking: {
      id: review.booking.id,
      referenceCode: review.booking.referenceCode,
      pickupAddress: review.booking.pickupAddress,
      dropoffAddress: review.booking.dropoffAddress,
      pickupDateTime: review.booking.pickupDateTime.toISOString(),
      customerName: review.booking.customer.name,
      customerEmail: review.booking.customer.email,
    },
  }
}

async function loadReviews(status?: ReviewStatus) {
  return prisma.review.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      driver: { select: { id: true, name: true, avgRating: true } },
      booking: {
        select: {
          id: true,
          referenceCode: true,
          pickupAddress: true,
          dropoffAddress: true,
          pickupDateTime: true,
          customer: { select: { name: true, email: true } },
        },
      },
    },
  })
}

export async function GET(request: Request) {
  const user = await getSession()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const statusParam = new URL(request.url).searchParams.get("status")
  const status =
    statusParam === "pending" ||
    statusParam === "approved" ||
    statusParam === "rejected"
      ? statusParam
      : undefined

  const reviews = await loadReviews(status)
  return NextResponse.json({
    reviews: reviews.map(serializeAdminReview),
  })
}
