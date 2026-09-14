import { NextResponse } from "next/server"

import { requireStaffSession } from "@/lib/auth"
import { prisma } from "@/lib/db"
import {
  listAdminTrustpilotTestimonials,
  normalizeTrustpilotUrl,
  serializeTrustpilotTestimonial,
  trustpilotTestimonialInputSchema,
} from "@/lib/trustpilot-testimonials"
import { revalidateAllLocales } from "@/lib/revalidate-locales"

export async function GET(request: Request) {
  const session = await requireStaffSession(request)
  if ("error" in session) return session.error

  const rows = await listAdminTrustpilotTestimonials()
  return NextResponse.json({
    testimonials: rows.map(serializeTrustpilotTestimonial),
  })
}

export async function POST(request: Request) {
  const session = await requireStaffSession(request)
  if ("error" in session) return session.error

  const body = await request.json().catch(() => ({}))
  const parsed = trustpilotTestimonialInputSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid testimonial.", details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const input = parsed.data
  const row = await prisma.trustpilotTestimonial.create({
    data: {
      authorName: input.authorName,
      title: input.title ?? "",
      rating: input.rating,
      body: input.body,
      reviewedAt: input.reviewedAt ? new Date(input.reviewedAt) : null,
      sourceUrl: normalizeTrustpilotUrl(input.sourceUrl),
      sortOrder: input.sortOrder ?? 0,
      published: input.published ?? true,
    },
  })
  revalidateAllLocales("/")

  return NextResponse.json(
    { testimonial: serializeTrustpilotTestimonial(row) },
    { status: 201 },
  )
}
