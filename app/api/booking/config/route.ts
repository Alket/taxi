import { NextResponse } from "next/server"

import { withAirportCoords } from "@/lib/airports"
import { matchDestinationForZoneName } from "@/lib/destinations"
import { prisma } from "@/lib/db"
import { resolveDestinationCards } from "@/lib/page-content"
import { getSettingsRow, parseAirports } from "@/lib/settings"
import { vehicleCapacitiesFromSettingsRow } from "@/lib/vehicles"

/** Public booking config — airports, service zones, support contact. */
export async function GET() {
  try {
    const [row, zones, destinationCards] = await Promise.all([
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
    ])

    const airports = withAirportCoords(parseAirports(row.airports))
    const imageByDestinationId = new Map(
      destinationCards.map((card) => [card.id, card.image]),
    )
    const vehicleCapacities = vehicleCapacitiesFromSettingsRow(row)

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
    })
  } catch {
    return NextResponse.json(
      { error: "Booking configuration unavailable." },
      { status: 500 },
    )
  }
}
