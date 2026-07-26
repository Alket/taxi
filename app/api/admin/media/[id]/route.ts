import { NextResponse } from "next/server"
import { z } from "zod"

import { requireAdmin } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { deleteMediaFile, serializeMediaAsset } from "@/lib/media"

const patchSchema = z.object({
  title: z.string().trim().max(200).optional(),
  description: z.string().trim().max(2000).optional(),
  alt: z.string().trim().max(300).optional(),
})

type RouteContext = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, context: RouteContext) {
  const denied = await requireAdmin()
  if (denied) return denied

  const { id } = await context.params
  if (!id) {
    return NextResponse.json({ error: "Missing id." }, { status: 400 })
  }

  const body = await request.json().catch(() => null)
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 })
  }

  const existing = await prisma.mediaAsset.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: "Media not found." }, { status: 404 })
  }

  const asset = await prisma.mediaAsset.update({
    where: { id },
    data: {
      ...(parsed.data.title != null ? { title: parsed.data.title } : {}),
      ...(parsed.data.description != null
        ? { description: parsed.data.description }
        : {}),
      ...(parsed.data.alt != null ? { alt: parsed.data.alt } : {}),
    },
  })

  return NextResponse.json({ asset: serializeMediaAsset(asset) })
}

export async function DELETE(_request: Request, context: RouteContext) {
  const denied = await requireAdmin()
  if (denied) return denied

  const { id } = await context.params
  if (!id) {
    return NextResponse.json({ error: "Missing id." }, { status: 400 })
  }

  const existing = await prisma.mediaAsset.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: "Media not found." }, { status: 404 })
  }

  await prisma.mediaAsset.delete({ where: { id } })
  await deleteMediaFile(existing.url)

  return NextResponse.json({ ok: true })
}
