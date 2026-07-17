import { NextResponse } from "next/server"

import { getDriverSession } from "@/lib/driver-auth"

export async function GET() {
  const driver = await getDriverSession()
  if (!driver) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  return NextResponse.json({ driver })
}
