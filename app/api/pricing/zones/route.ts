import { NextResponse } from "next/server"
import { nextId, store } from "@/lib/store"
import type { Zone } from "@/lib/types"

export async function GET() {
  return NextResponse.json({ zones: store.zones })
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  if (!body.name) {
    return NextResponse.json({ error: "Zone name is required." }, { status: 400 })
  }
  const zone: Zone = {
    id: nextId("zone"),
    name: body.name,
  }
  store.zones.push(zone)
  return NextResponse.json({ zone }, { status: 201 })
}
