import { NextResponse } from "next/server"

import { requireAdmin } from "@/lib/auth"
import {
  computeWhatsappConnectionStatus,
  getSettings,
} from "@/lib/settings"

export async function POST() {
  const denied = await requireAdmin(
    "Your account cannot access settings. Ask an admin.",
  )
  if (denied) return denied

  try {
    const settings = await getSettings()

    if (computeWhatsappConnectionStatus() !== "connected") {
      return NextResponse.json(
        { error: "WhatsApp is disconnected. Reconnect before sending a test." },
        { status: 409 },
      )
    }

    return NextResponse.json({
      ok: true,
      sentTo: settings.supportWhatsApp,
    })
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || "Failed to send test message." },
      { status: 500 },
    )
  }
}
