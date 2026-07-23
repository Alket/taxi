import { NextResponse } from "next/server"

import { serializeAdminUser } from "@/lib/admin-users"
import { getSession, requireAdmin } from "@/lib/auth"
import { prisma } from "@/lib/db"

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function PATCH(request: Request, context: RouteContext) {
  const denied = await requireAdmin("Only admins can manage team members.")
  if (denied) return denied

  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await context.params
  const body = await request.json().catch(() => ({}))

  const target = await prisma.adminUser.findUnique({ where: { id } })
  if (!target) {
    return NextResponse.json(
      { error: "Team member not found." },
      { status: 404 },
    )
  }

  const data: { suspended?: boolean } = {}

  if (typeof body.suspended === "boolean") {
    if (target.id === session.id) {
      return NextResponse.json(
        { error: "You cannot suspend your own account." },
        { status: 400 },
      )
    }
    data.suspended = body.suspended
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No changes provided." }, { status: 400 })
  }

  const updated = await prisma.adminUser.update({
    where: { id },
    data,
  })

  return NextResponse.json({ user: serializeAdminUser(updated) })
}

export async function DELETE(_request: Request, context: RouteContext) {
  const denied = await requireAdmin("Only admins can manage team members.")
  if (denied) return denied

  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await context.params

  if (id === session.id) {
    return NextResponse.json(
      { error: "You cannot delete your own account." },
      { status: 400 },
    )
  }

  const target = await prisma.adminUser.findUnique({
    where: { id },
    select: { id: true, email: true },
  })
  if (!target) {
    return NextResponse.json(
      { error: "Team member not found." },
      { status: 404 },
    )
  }

  await prisma.adminUser.delete({ where: { id } })
  return NextResponse.json({ ok: true, email: target.email })
}
