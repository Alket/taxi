import { NextResponse } from "next/server"

import { serializeAdminUser } from "@/lib/admin-users"
import { getSession } from "@/lib/auth"

export async function GET() {
  const user = await getSession()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  return NextResponse.json({ user: serializeAdminUser(user) })
}
