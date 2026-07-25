import { NextResponse } from "next/server"

import { requireAdmin } from "@/lib/auth"
import { listAdminPages } from "@/lib/page-content"

export async function GET() {
  const denied = await requireAdmin()
  if (denied) return denied

  const pages = await listAdminPages()
  return NextResponse.json({ pages })
}
