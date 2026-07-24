import { NextResponse } from "next/server"
import { z } from "zod"

import { getSession } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { recalculateDriverAvgRating } from "@/lib/reviews"

const bodySchema = z.object({
  status: z.enum(["approved", "rejected"]),
})

type RouteContext = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, context: RouteContext) {
  const user = await getSession()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await context.params
  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Status must be approved or rejected." },
      { status: 400 },
    )
  }

  const existing = await prisma.review.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: "Review not found." }, { status: 404 })
  }

  const updated = await prisma.review.update({
    where: { id },
    data: {
      status: parsed.data.status,
      moderatedAt: new Date(),
    },
  })

  // Approved reviews feed avgRating; rejecting (or un-approving) recalculates too.
  const avgRating = await recalculateDriverAvgRating(updated.driverId)

  return NextResponse.json({
    review: {
      id: updated.id,
      status: updated.status,
      moderatedAt: updated.moderatedAt?.toISOString() ?? null,
    },
    driverAvgRating: avgRating,
  })
}
