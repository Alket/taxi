import { NextResponse } from "next/server"

import { withAirportCoords } from "@/lib/airports"
import { prisma } from "@/lib/db"
import { getSettingsRow, parseAirports } from "@/lib/settings"

/** Public booking config — airports, service zones, support contact. */
export async function GET() {
  try {
    const [row, zones] = await Promise.all([
      getSettingsRow(),
      prisma.zone.findMany({
        where: { active: true },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          centroidLat: true,
          centroidLng: true,
        },
      }),
    ])

    const airports = withAirportCoords(parseAirports(row.airports))

    return NextResponse.json({
      companyName: row.companyName,
      supportEmail: row.supportEmail,
      supportPhone: row.supportPhone,
      depositPercentage: row.depositPercentage,
      roundTripDiscountPercent: row.roundTripDiscountPercent ?? 0,
      infantCarrierPrice: Number(row.infantCarrierPrice ?? 0),
      childSeatPrice: Number(row.childSeatPrice ?? 0),
      boosterSeatPrice: Number(row.boosterSeatPrice ?? 0),
      airports,
      zones: zones.map((zone) => ({
        id: zone.id,
        name: zone.name,
        lat: zone.centroidLat,
        lng: zone.centroidLng,
      })),
    })
  } catch {
    return NextResponse.json(
      { error: "Booking configuration unavailable." },
      { status: 500 },
    )
  }
}
