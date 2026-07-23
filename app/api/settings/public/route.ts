import { NextResponse } from "next/server"

import { withAirportCoords } from "@/lib/airports"
import { getSettingsRow, parseAirports } from "@/lib/settings"

/**
 * Public settings for the customer booking flow.
 * Safe subset only — no admin / payment secrets.
 */
export async function GET() {
  try {
    const row = await getSettingsRow()
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
      stripeEnabled: row.stripeEnabled ?? true,
      paypalEnabled: row.paypalEnabled ?? true,
      cashOnArrivalEnabled: row.cashOnArrivalEnabled ?? false,
      depositPaymentEnabled: row.depositPaymentEnabled ?? true,
      fullPaymentEnabled: row.fullPaymentEnabled ?? true,
      airports,
    })
  } catch {
    return NextResponse.json(
      { error: "Settings unavailable." },
      { status: 500 },
    )
  }
}
