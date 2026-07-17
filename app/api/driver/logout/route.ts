import { NextResponse } from "next/server"

import { clearDriverSession } from "@/lib/driver-auth"

export async function POST() {
  await clearDriverSession()
  return NextResponse.json({ success: true })
}
