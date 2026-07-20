import { NextResponse } from "next/server"

import { getSession } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { serializeStaffNotification } from "@/lib/staff-notifications"

export async function GET(request: Request) {
  const user = await getSession()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const unreadOnly = searchParams.get("unread") === "1"
  const take = Math.min(
    100,
    Math.max(1, Number(searchParams.get("limit") || 50) || 50),
  )

  const where = {
    audience: "admin" as const,
    ...(unreadOnly ? { readAt: null } : {}),
  }

  const [rows, unreadCount] = await Promise.all([
    prisma.staffNotification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take,
    }),
    prisma.staffNotification.count({
      where: { audience: "admin", readAt: null },
    }),
  ])

  return NextResponse.json({
    unreadCount,
    notifications: rows.map(serializeStaffNotification),
  })
}

/** Mark all admin notifications as read. */
export async function PATCH() {
  const user = await getSession()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const result = await prisma.staffNotification.updateMany({
    where: { audience: "admin", readAt: null },
    data: { readAt: new Date() },
  })

  return NextResponse.json({ marked: result.count })
}
