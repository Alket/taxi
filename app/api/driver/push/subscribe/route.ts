import { NextResponse } from "next/server"
import { z } from "zod"

import { requireDriverSession } from "@/lib/driver-auth"
import {
  deletePushSubscription,
  savePushSubscription,
} from "@/lib/push-notifications"

const bodySchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
})

export async function POST(request: Request) {
  const session = await requireDriverSession()
  if ("error" in session) return session.error

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid subscription." }, { status: 400 })
  }

  try {
    await savePushSubscription({
      endpoint: parsed.data.endpoint,
      keys: parsed.data.keys,
      audience: "driver",
      ownerId: session.driver.id,
      userAgent: request.headers.get("user-agent"),
    })
  } catch (err) {
    console.error("[driver/push/subscribe]", err)
    return NextResponse.json(
      { error: "Could not save notification subscription." },
      { status: 500 },
    )
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(request: Request) {
  const session = await requireDriverSession()
  if ("error" in session) return session.error

  const body = await request.json().catch(() => ({}))
  const endpoint = typeof body.endpoint === "string" ? body.endpoint : null
  if (!endpoint) {
    return NextResponse.json({ error: "endpoint required" }, { status: 400 })
  }

  await deletePushSubscription(endpoint)
  return NextResponse.json({ ok: true })
}
