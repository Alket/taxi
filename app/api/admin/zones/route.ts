import { NextResponse } from "next/server"
import { z } from "zod"

import { prisma } from "@/lib/db"
import { serializeZone } from "@/lib/pricing-admin"
import type { VehicleType } from "@/lib/types"

const VEHICLE_TYPES: VehicleType[] = ["sedan", "comfort", "minivan", "premium"]

/** Same relative tiers as seed — used when a zone is created without custom fares. */
const VEHICLE_MULTIPLIERS: Record<VehicleType, number> = {
  sedan: 1,
  comfort: 1.28,
  minivan: 1.55,
  premium: 1.85,
}

const createZoneSchema = z.object({
  name: z.string().trim().min(1).max(200),
  /** Optional transfer price for Sedan; other vehicles scale from this. */
  defaultMinFare: z.coerce.number().positive().optional(),
})

export async function GET() {
  const zones = await prisma.zone.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
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

  const sedanFare = Number((parsed.data.defaultMinFare ?? 40).toFixed(2))

  try {
    const zone = await prisma.$transaction(async (tx) => {
      const created = await tx.zone.create({
        data: { name: parsed.data.name },
        select: { id: true, name: true },
      })

      // Booking quotes every vehicle type — create a rule for each so the
      // destination is immediately bookable after adding a zone.
      await tx.pricingRule.createMany({
        data: VEHICLE_TYPES.map((vehicleType) => {
          const fare = Number(
            (sedanFare * VEHICLE_MULTIPLIERS[vehicleType]).toFixed(2),
          )
          return {
            zoneId: created.id,
            vehicleType,
            baseFare: fare,
            perKmRate: 1,
            minFare: fare,
            currency: "EUR",
          }
        }),
      })

      return created
    })

    return NextResponse.json({ zone: serializeZone(zone) }, { status: 201 })
  } catch (err) {
    const code = (err as { code?: string }).code
    if (code === "P2002") {
      return NextResponse.json(
        { error: "A zone with that name already exists." },
        { status: 409 },
      )
    }
    console.error("[admin/zones] create failed:", err)
    return NextResponse.json(
      { error: "Could not create zone." },
      { status: 500 },
    )
  }
}
