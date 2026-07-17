import { NextResponse } from "next/server"
import { z } from "zod"

import { prisma } from "@/lib/db"
import { serializeZone } from "@/lib/pricing-admin"

const createZoneSchema = z.object({
  name: z.string().trim().min(1).max(200),
  centroidLat: z.coerce.number(),
  centroidLng: z.coerce.number(),
})

export async function GET() {
  const zones = await prisma.zone.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      centroidLat: true,
      centroidLng: true,
    },
  })

  return NextResponse.json({ zones: zones.map(serializeZone) })
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const parsed = createZoneSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid zone payload." }, { status: 400 })
  }

  const zone = await prisma.zone.create({
    data: parsed.data,
    select: {
      id: true,
      name: true,
      centroidLat: true,
      centroidLng: true,
    },
  })

  return NextResponse.json({ zone: serializeZone(zone) }, { status: 201 })
}

