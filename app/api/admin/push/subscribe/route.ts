import { NextResponse } from "next/server"
import { z } from "zod"

import { getSession } from "@/lib/auth"
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
  const user = await getSession()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid subscription." }, { status: 400 })
  }

  try {
    await savePushSubscription({
      endpoint: parsed.data.endpoint,
      keys: parsed.data.keys,
      audience: "admin",
      ownerId: user.id,
      userAgent: request.headers.get("user-agent"),
    })
  } catch (err) {
    console.error("[admin/push/subscribe]", err)
    return NextResponse.json(
      { error: "Could not save notification subscription." },
      { status: 500 },
    )
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(request: Request) {
  const user = await getSession()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const endpoint = typeof body.endpoint === "string" ? body.endpoint : null
  if (!endpoint) {
    return NextResponse.json({ error: "endpoint required" }, { status: 400 })
  }

  await deletePushSubscription(endpoint)
  return NextResponse.json({ ok: true })
}
