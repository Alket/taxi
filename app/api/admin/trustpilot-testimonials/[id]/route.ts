import { NextResponse } from "next/server"

import { requireCanDelete, requireStaffSession } from "@/lib/auth"
import { prisma } from "@/lib/db"
import {
  normalizeTrustpilotUrl,
  serializeTrustpilotTestimonial,
  trustpilotTestimonialInputSchema,
} from "@/lib/trustpilot-testimonials"
import { revalidateAllLocales } from "@/lib/revalidate-locales"

type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, ctx: Ctx) {
  const session = await requireStaffSession(request)
  if ("error" in session) return session.error

  const { id } = await ctx.params
  if (!id || id.length > 64) {
    return NextResponse.json({ error: "Not found." }, { status: 404 })
  }

  const existing = await prisma.trustpilotTestimonial.findUnique({
    where: { id },
  })
  if (!existing) {
    return NextResponse.json({ error: "Not found." }, { status: 404 })
  }

  const body = await request.json().catch(() => ({}))
  const parsed = trustpilotTestimonialInputSchema.partial().safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid testimonial.", details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const input = parsed.data
  const row = await prisma.trustpilotTestimonial.update({
    where: { id },
    data: {
      ...(input.authorName !== undefined
        ? { authorName: input.authorName }
        : {}),
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.rating !== undefined ? { rating: input.rating } : {}),
      ...(input.body !== undefined ? { body: input.body } : {}),
      ...(input.reviewedAt !== undefined
        ? {
            reviewedAt: input.reviewedAt ? new Date(input.reviewedAt) : null,
          }
        : {}),
      ...(input.sourceUrl !== undefined
        ? { sourceUrl: normalizeTrustpilotUrl(input.sourceUrl) }
        : {}),
      ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
      ...(input.published !== undefined ? { published: input.published } : {}),
    },
  })
  revalidateAllLocales("/")

  return NextResponse.json({
    testimonial: serializeTrustpilotTestimonial(row),
  })
}

export async function DELETE(_request: Request, ctx: Ctx) {
  const denied = await requireCanDelete()
  if (denied) return denied

  const { id } = await ctx.params
  if (!id || id.length > 64) {
    return NextResponse.json({ error: "Not found." }, { status: 404 })
  }

  const existing = await prisma.trustpilotTestimonial.findUnique({
    where: { id },
  })
  if (!existing) {
    return NextResponse.json({ error: "Not found." }, { status: 404 })
  }

  await prisma.trustpilotTestimonial.delete({ where: { id } })
  revalidateAllLocales("/")

  return NextResponse.json({ ok: true })
}
