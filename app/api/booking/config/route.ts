import { NextResponse } from "next/server"

import { withAirportCoords } from "@/lib/airports"
import { clientIpFromRequest } from "@/lib/client-ip"
import { matchDestinationForZoneName } from "@/lib/destinations"
import { prisma } from "@/lib/db"
import { resolveDestinationCards } from "@/lib/page-content"
import { takeRateLimit } from "@/lib/rate-limit"
import { getSettingsRow, parseAirports } from "@/lib/settings"
import type { VehicleType } from "@/lib/types"
import { vehicleCapacitiesFromSettingsRow, getEnabledVehicleTypes } from "@/lib/vehicles"

/** Public booking config — airports, service zones, support contact. */
export async function GET(request: Request) {
  const ip = clientIpFromRequest(request)
  const limited = takeRateLimit(`public-booking-config:${ip}`, 120, 5 * 60 * 1000)
  if (!limited.ok) {
    return NextResponse.json(
      { error: `Too many requests. Try again in ${limited.retryAfterSec}s.` },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    )
  }

  try {
    const [row, zones, destinationCards, corridorRows] = await Promise.all([
      getSettingsRow(),
      prisma.zone.findMany({
        where: { active: true },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
        },
      }),
      resolveDestinationCards(),
      prisma.interZoneFare.findMany({
        where: { active: true },
        select: { zoneAId: true, zoneBId: true, vehicleType: true },
      }),
    ])

    const airports = withAirportCoords(parseAirports(row.airports))
    const imageByDestinationId = new Map(
      destinationCards.map((card) => [card.id, card.image]),
    )
    const vehicleCapacities = vehicleCapacitiesFromSettingsRow(row)
    const enabledVehicleTypes = getEnabledVehicleTypes(row)

    // Group active fares by pair — IDs + vehicleTypes only (never fares).
    const corridorByPair = new Map<
      string,
      { zoneAId: string; zoneBId: string; vehicleTypes: Set<VehicleType> }
    >()
    for (const fare of corridorRows) {
      const key = `${fare.zoneAId}|${fare.zoneBId}`
      let entry = corridorByPair.get(key)
      if (!entry) {
        entry = {
          zoneAId: fare.zoneAId,
          zoneBId: fare.zoneBId,
          vehicleTypes: new Set(),
        }
        corridorByPair.set(key, entry)
      }
      entry.vehicleTypes.add(fare.vehicleType as VehicleType)
    }

    return NextResponse.json({
      companyName: row.companyName,
      supportEmail: row.supportEmail,
      supportPhone: row.supportPhone,
      depositPercentage: row.depositPercentage,
      roundTripDiscountPercent: row.roundTripDiscountPercent ?? 0,
      infantCarrierPrice: Number(row.infantCarrierPrice ?? 0),
      childSeatPrice: Number(row.childSeatPrice ?? 0),
      boosterSeatPrice: Number(row.boosterSeatPrice ?? 0),
      vehicleCapacities,
      sedanEnabled: row.sedanEnabled ?? true,
      minivanEnabled: row.minivanEnabled ?? true,
      enabledVehicleTypes,
      airports,
      zones: zones.map((zone) => {
        const destination = matchDestinationForZoneName(zone.name)
        const image = destination
          ? imageByDestinationId.get(destination.id) || destination.image
          : undefined
        return {
          id: zone.id,
          name: zone.name,
          ...(image ? { image } : {}),
        }
      }),
      /** Active city↔city corridors (IDs + vehicleTypes only; no prices). */
      cityCorridors: Array.from(corridorByPair.values()).map((entry) => ({
        zoneAId: entry.zoneAId,
        zoneBId: entry.zoneBId,
        vehicleTypes: Array.from(entry.vehicleTypes).sort(),
      })),
    })
  } catch {
    return NextResponse.json(
      { error: "Booking configuration unavailable." },
      { status: 500 },
    )
  }
}
