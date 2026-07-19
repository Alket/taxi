import { NextResponse } from "next/server"
import { z } from "zod"

import type { VehicleType } from "@/lib/types"
import {
  calculatePriceForZone,
  UncoveredDestinationError,
} from "@/lib/pricing"
import { getBookingPolicy } from "@/lib/settings"

const querySchema = z.object({
  vehicleType: z.enum(["sedan", "comfort", "minivan", "premium"]),
  zoneId: z.string().min(1),
})

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)

  const parsed = querySchema.safeParse({
    vehicleType: searchParams.get("vehicleType"),
    zoneId: searchParams.get("zoneId"),
  })

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid quote parameters." },
      { status: 400 },
    )
  }

  const { vehicleType, zoneId } = parsed.data

  let totalPrice: number
  try {
    totalPrice = await calculatePriceForZone(
      zoneId,
      vehicleType as VehicleType,
    )
  } catch (error) {
    if (error instanceof UncoveredDestinationError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 404 },
      )
    }
    return NextResponse.json(
      { error: (error as Error).message || "Failed to calculate quote." },
      { status: 500 },
    )
  }

  let depositPercentage: number
  try {
    ;({ depositPercentage } = await getBookingPolicy())
  } catch {
    return NextResponse.json(
      { error: "Settings not configured." },
      { status: 500 },
    )
  }

  const depositAmount = Number(
    ((totalPrice * depositPercentage) / 100).toFixed(2),
  )
  const balanceDue = Number((totalPrice - depositAmount).toFixed(2))

  return NextResponse.json({
    totalPrice,
    depositAmount,
    balanceDue,
  })
}
