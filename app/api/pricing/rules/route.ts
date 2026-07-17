import { NextResponse } from "next/server"
import { nextId, store } from "@/lib/store"
import type { PricingRule } from "@/lib/types"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const zoneId = searchParams.get("zoneId")
  let results = [...store.pricingRules]
  if (zoneId && zoneId !== "all") {
    results = results.filter((r) => r.zoneId === zoneId)
  }
  return NextResponse.json({ rules: results })
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const zone = store.zones.find((z) => z.id === body.zoneId)
  if (!zone) {
    return NextResponse.json({ error: "Valid zone is required." }, { status: 400 })
  }
  const rule: PricingRule = {
    id: nextId("rule"),
    zoneId: zone.id,
    zoneName: zone.name,
    vehicleType: body.vehicleType || "sedan",
    baseFare: Number(body.baseFare) || 0,
    perKmRate: Number(body.perKmRate) || 0,
    minFare: Number(body.minFare) || 0,
    currency: store.currency,
  }
  store.pricingRules.push(rule)
  return NextResponse.json({ rule }, { status: 201 })
}

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => ({}))
  const rule = store.pricingRules.find((r) => r.id === body.id)
  if (!rule) {
    return NextResponse.json({ error: "Rule not found" }, { status: 404 })
  }
  if (body.baseFare !== undefined) rule.baseFare = Number(body.baseFare)
  if (body.perKmRate !== undefined) rule.perKmRate = Number(body.perKmRate)
  if (body.minFare !== undefined) rule.minFare = Number(body.minFare)
  if (body.vehicleType) rule.vehicleType = body.vehicleType
  return NextResponse.json({ rule })
}
