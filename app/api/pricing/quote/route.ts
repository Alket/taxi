import { NextResponse } from "next/server"
import { z } from "zod"

import { getSettingsRow } from "@/lib/settings"
import {
  calculateQuoteForZone,
  UncoveredDestinationError,
} from "@/lib/pricing"
import type { VehicleType } from "@/lib/types"
import {
  assertVehicleTypeEnabled,
  VehicleDisabledError,
  vehicleTypeSchema,
} from "@/lib/vehicles"

const bodySchema = z.object({
  direction: z.enum(["airport_to_dest", "dest_to_airport"]).optional(),
  vehicleType: vehicleTypeSchema,
  zoneId: z.string().min(1),
})

export async function POST(request: Request) {
  const json = await request.json().catch(() => null)
  const parsed = bodySchema.safeParse(json)

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid quote parameters." },
      { status: 400 },
    )
  }

  const { vehicleType, zoneId } = parsed.data

  try {
    const settings = await getSettingsRow()
    assertVehicleTypeEnabled(settings, vehicleType as VehicleType)

    const quote = await calculateQuoteForZone(
      zoneId,
      vehicleType as VehicleType,
    )

    return NextResponse.json({
      vehicleType,
      price: quote.price,
      distanceKm: quote.distanceKm,
      durationMin: quote.durationMin,
      zoneName: quote.zoneName,
      zoneId: quote.zoneId,
    })
  } catch (error) {
    if (error instanceof VehicleDisabledError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 400 },
      )
    }
    if (error instanceof UncoveredDestinationError) {
      return NextResponse.json(
        {
          error: "We don't currently cover this destination.",
          code: error.code,
        },
        { status: 404 },
      )
    }

    return NextResponse.json(
      { error: (error as Error).message || "Failed to calculate quote." },
      { status: 500 },
    )
  }
}
