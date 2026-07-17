import { NextResponse } from "next/server"

import { serializeAdminUser } from "@/lib/admin-users"
import { prisma } from "@/lib/db"

export async function GET() {
  const users = await prisma.adminUser.findMany({
    orderBy: [{ name: "asc" }, { email: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      suspended: true,
      lastLoginAt: true,
      requiresPasswordReset: true,
    },
  })

  return NextResponse.json({
    users: users.map(serializeAdminUser),
  })
}
