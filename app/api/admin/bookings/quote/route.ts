import { NextResponse } from "next/server"
import { z } from "zod"

import type { VehicleType, Direction } from "@/lib/types"
import { calculatePrice, type LatLng } from "@/lib/pricing"
import { getBookingPolicy } from "@/lib/settings"

const querySchema = z.object({
  direction: z.enum(["airport_to_dest", "dest_to_airport"]).default("airport_to_dest"),
  vehicleType: z.enum(["sedan", "comfort", "minivan", "premium"]),
  pickupLat: z.coerce.number(),
  pickupLng: z.coerce.number(),
  dropoffLat: z.coerce.number(),
  dropoffLng: z.coerce.number(),
})

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)

  const parsed = querySchema.safeParse({
    direction: searchParams.get("direction"),
    vehicleType: searchParams.get("vehicleType"),
    pickupLat: searchParams.get("pickupLat"),
    pickupLng: searchParams.get("pickupLng"),
    dropoffLat: searchParams.get("dropoffLat"),
    dropoffLng: searchParams.get("dropoffLng"),
  })

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid quote parameters." },
      { status: 400 },
    )
  }

  const { direction, vehicleType, pickupLat, pickupLng, dropoffLat, dropoffLng } =
    parsed.data

  // `calculatePrice` expects `dropoffCoords` to be the non-airport end.
  const pickupCoords: LatLng =
    direction === "airport_to_dest"
      ? { lat: pickupLat, lng: pickupLng }
      : { lat: dropoffLat, lng: dropoffLng }

  const dropoffCoords: LatLng =
    direction === "airport_to_dest"
      ? { lat: dropoffLat, lng: dropoffLng }
      : { lat: pickupLat, lng: pickupLng }

  const totalPrice = await calculatePrice(
    pickupCoords,
    dropoffCoords,
    vehicleType as VehicleType,
  )

  let depositPercentage: number
  try {
    ;({ depositPercentage } = await getBookingPolicy())
  } catch {
    return NextResponse.json(
      { error: "Settings not configured." },
      { status: 500 },
    )
  }

  const depositAmount = Number(((totalPrice * depositPercentage) / 100).toFixed(2))
  const balanceDue = Number((totalPrice - depositAmount).toFixed(2))

  return NextResponse.json({
    totalPrice,
    depositAmount,
    balanceDue,
  })
}

