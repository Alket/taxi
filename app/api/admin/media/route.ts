import { NextResponse } from "next/server"

import { requireAdmin } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { serializeMediaAsset, syncMediaAssetsFromDisk } from "@/lib/media"

export async function GET() {
  const denied = await requireAdmin()
  if (denied) return denied

  await syncMediaAssetsFromDisk()

  const rows = await prisma.mediaAsset.findMany({
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json({
    assets: rows.map(serializeMediaAsset),
  })
}
