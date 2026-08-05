import { NextResponse } from "next/server"

import { requireAdmin, requireStaffSession } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { serializeStaffNotification } from "@/lib/staff-notifications"

export async function GET(request: Request) {
  const session = await requireStaffSession(request)
  if ("error" in session) return session.error

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
export async function PATCH(request: Request) {
  const session = await requireStaffSession(request)
  if ("error" in session) return session.error

  const result = await prisma.staffNotification.updateMany({
    where: { audience: "admin", readAt: null },
    data: { readAt: new Date() },
  })

  return NextResponse.json({ marked: result.count })
}

/** Permanently delete all admin inbox notifications. Full admins only. */
export async function DELETE() {
  const denied = await requireAdmin()
  if (denied) return denied

  const result = await prisma.staffNotification.deleteMany({
    where: { audience: "admin" },
  })

  return NextResponse.json({ deleted: result.count })
}
