import { NextResponse } from "next/server"

import { clientIpFromRequest } from "@/lib/client-ip"
import { takeRateLimit } from "@/lib/rate-limit"
import { z } from "zod"

import { getSettingsRow } from "@/lib/settings"
import {
  calculateQuoteForInterZone,
  calculateQuoteForZone,
  UncoveredDestinationError,
} from "@/lib/pricing"
import type { VehicleType } from "@/lib/types"
import {
  assertVehicleTypeEnabled,
  VehicleDisabledError,
  vehicleTypeSchema,
} from "@/lib/vehicles"

const bodySchema = z
  .object({
    direction: z
      .enum(["airport_to_dest", "dest_to_airport", "zone_to_zone"])
      .optional(),
    vehicleType: vehicleTypeSchema,
    zoneId: z.string().min(1),
    toZoneId: z.string().min(1).optional().nullable(),
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

export async function POST(request: Request) {
  const ip = clientIpFromRequest(request)
  const limited = takeRateLimit(`public-pricing-quote:${ip}`, 60, 5 * 60 * 1000)
  if (!limited.ok) {
    return NextResponse.json(
      { error: `Too many quote requests. Try again in ${limited.retryAfterSec}s.` },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    )
  }

  const json = await request.json().catch(() => null)
  const parsed = bodySchema.safeParse(json)

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid quote parameters." },
      { status: 400 },
    )
  }

  const { vehicleType, zoneId, toZoneId, direction } = parsed.data

  try {
    const settings = await getSettingsRow()
    assertVehicleTypeEnabled(settings, vehicleType as VehicleType)

    const quote =
      direction === "zone_to_zone" && toZoneId
        ? await calculateQuoteForInterZone(
            zoneId,
            toZoneId,
            vehicleType as VehicleType,
          )
        : await calculateQuoteForZone(zoneId, vehicleType as VehicleType)

    return NextResponse.json({
      vehicleType,
      price: quote.price,
      distanceKm: quote.distanceKm,
      durationMin: quote.durationMin,
      zoneName: quote.zoneName,
      zoneId: quote.zoneId,
      toZoneId: quote.toZoneId ?? null,
      toZoneName: quote.toZoneName ?? null,
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
          error:
            error.message === "No fare for this route."
              ? error.message
              : "We don't currently cover this destination.",
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
