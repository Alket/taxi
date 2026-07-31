import { NextResponse } from "next/server"

import { requireStaffSession } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { serializeStaffNotification } from "@/lib/staff-notifications"

type RouteContext = {
  params: Promise<{ id: string }>
}

/** Mark a single notification as read. */
export async function PATCH(request: Request, context: RouteContext) {
  const session = await requireStaffSession(request)
  if ("error" in session) return session.error

  const { id } = await context.params

  const existing = await prisma.staffNotification.findFirst({
    where: { id, audience: "admin" },
  })
  if (!existing) {
    return NextResponse.json({ error: "Notification not found" }, { status: 404 })
  }

  const updated =
    existing.readAt != null
      ? existing
      : await prisma.staffNotification.update({
          where: { id },
          data: { readAt: new Date() },
        })

  return NextResponse.json({
    notification: serializeStaffNotification(updated),
  })
}
