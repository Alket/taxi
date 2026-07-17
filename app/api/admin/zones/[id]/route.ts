import { NextResponse } from "next/server"
import { z } from "zod"

import { requireCanDelete } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { serializeZone } from "@/lib/pricing-admin"

const updateZoneSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    centroidLat: z.coerce.number().optional(),
    centroidLng: z.coerce.number().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "No fields provided.",
  })

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params
  const body = await request.json().catch(() => ({}))
  const parsed = updateZoneSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid zone payload." }, { status: 400 })
  }

  const existing = await prisma.zone.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: "Zone not found." }, { status: 404 })
  }

  try {
    const zone = await prisma.zone.update({
      where: { id },
      data: parsed.data,
      select: {
        id: true,
        name: true,
        centroidLat: true,
        centroidLng: true,
      },
    })
    return NextResponse.json({ zone: serializeZone(zone) })
  } catch {
    return NextResponse.json(
      { error: "Could not update zone. Name may already be in use." },
      { status: 409 },
    )
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const denied = await requireCanDelete()
  if (denied) return denied

  const { id } = await context.params

  const existing = await prisma.zone.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      _count: { select: { pricingRules: true } },
    },
  })
  if (!existing) {
    return NextResponse.json({ error: "Zone not found." }, { status: 404 })
  }

  await prisma.zone.delete({ where: { id } })
  return NextResponse.json({
    ok: true,
    deletedRules: existing._count.pricingRules,
  })
}
