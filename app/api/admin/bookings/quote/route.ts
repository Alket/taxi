import { NextResponse } from "next/server"
import { z } from "zod"

import { requireStaffSession } from "@/lib/auth"
import type { VehicleType } from "@/lib/types"
import {
  calculatePriceForInterZone,
  calculatePriceForZone,
  UncoveredDestinationError,
} from "@/lib/pricing"
import { getBookingPolicy, getSettingsRow } from "@/lib/settings"
import {
  assertVehicleTypeEnabled,
  VehicleDisabledError,
  vehicleTypeSchema,
} from "@/lib/vehicles"

const querySchema = z
  .object({
    vehicleType: vehicleTypeSchema,
    zoneId: z.string().min(1),
    toZoneId: z.string().min(1).optional().nullable(),
    direction: z
      .enum(["airport_to_dest", "dest_to_airport", "zone_to_zone"])
      .optional()
      .nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.direction === "zone_to_zone" && !data.toZoneId) {
      ctx.addIssue({
        code: "custom",
        path: ["toZoneId"],
        message: "toZoneId is required for city-to-city quotes.",
      })
    }
  })

export async function GET(request: Request) {
  const session = await requireStaffSession(request)
  if ("error" in session) return session.error

  const { searchParams } = new URL(request.url)

  const parsed = querySchema.safeParse({
    vehicleType: searchParams.get("vehicleType"),
    zoneId: searchParams.get("zoneId"),
    toZoneId: searchParams.get("toZoneId"),
    direction: searchParams.get("direction"),
  })

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid quote parameters." },
      { status: 400 },
    )
  }

  const { vehicleType, zoneId, toZoneId, direction } = parsed.data

  let totalPrice: number
  try {
    const settings = await getSettingsRow()
    assertVehicleTypeEnabled(settings, vehicleType as VehicleType)
    totalPrice =
      direction === "zone_to_zone" && toZoneId
        ? await calculatePriceForInterZone(
            zoneId,
            toZoneId,
            vehicleType as VehicleType,
          )
        : await calculatePriceForZone(zoneId, vehicleType as VehicleType)
  } catch (error) {
    if (error instanceof VehicleDisabledError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 400 },
      )
    }
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
