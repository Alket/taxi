import { NextResponse } from "next/server"
import { z } from "zod"

import { requireAdmin, requireStaffSession } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { serializeZone } from "@/lib/pricing-admin"
import type { VehicleType } from "@/lib/types"
import { VEHICLE_TYPE_VALUES } from "@/lib/vehicles"

const VEHICLE_TYPES: VehicleType[] = [...VEHICLE_TYPE_VALUES]

/** Same relative tiers as seed — used when a zone is created without custom fares. */
const VEHICLE_MULTIPLIERS: Record<VehicleType, number> = {
  sedan: 1,
  minivan: 1.55,
}

const createZoneSchema = z.object({
  name: z.string().trim().min(1).max(200),
  /** Optional transfer price for Sedan; other vehicles scale from this. */
  defaultMinFare: z.coerce.number().positive().optional(),
})

export async function GET(request: Request) {
  const session = await requireStaffSession(request)
  if ("error" in session) return session.error

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
  const denied = await requireAdmin(
    "Your account cannot create zones. Ask an admin.",
  )
  if (denied) return denied

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
