import { NextResponse } from "next/server"

import { getVapidPublicKey } from "@/lib/push-notifications"

export async function GET() {
  const publicKey = getVapidPublicKey()
  if (!publicKey) {
    return NextResponse.json(
      { error: "Push notifications are not configured.", configured: false },
      { status: 503 },
    )
  }
  return NextResponse.json({ publicKey, configured: true })
}
