import { NextResponse } from "next/server"
import { z } from "zod"

import {
  calculateQuote,
  UncoveredDestinationError,
  type LatLng,
} from "@/lib/pricing"
import type { VehicleType } from "@/lib/types"

const bodySchema = z.object({
  direction: z.enum(["airport_to_dest", "dest_to_airport"]),
  vehicleType: z.enum(["sedan", "comfort", "minivan", "premium"]),
  pickupLat: z.number().finite(),
  pickupLng: z.number().finite(),
  dropoffLat: z.number().finite(),
  dropoffLng: z.number().finite(),
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

  const {
    direction,
    vehicleType,
    pickupLat,
    pickupLng,
    dropoffLat,
    dropoffLng,
  } = parsed.data

  // calculateQuote expects airport end as pickupCoords, destination as dropoffCoords.
  const airportCoords: LatLng =
    direction === "airport_to_dest"
      ? { lat: pickupLat, lng: pickupLng }
      : { lat: dropoffLat, lng: dropoffLng }

  const destinationCoords: LatLng =
    direction === "airport_to_dest"
      ? { lat: dropoffLat, lng: dropoffLng }
      : { lat: pickupLat, lng: pickupLng }

  try {
    const quote = await calculateQuote(
      airportCoords,
      destinationCoords,
      vehicleType as VehicleType,
    )

    return NextResponse.json({
      vehicleType,
      price: quote.price,
      distanceKm: quote.distanceKm,
      durationMin: quote.durationMin,
      zoneName: quote.zoneName,
    })
  } catch (error) {
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
