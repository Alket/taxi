import { revalidatePath } from "next/cache"
import { NextResponse } from "next/server"
import { z } from "zod"

import { requireAdmin } from "@/lib/auth"
import { revalidateAllLocales } from "@/lib/revalidate-locales"
import {
  deleteOrResetTransfer,
  getAdminTransfer,
  saveTransferSeed,
} from "@/lib/transfers/cms"
import type { TransferRouteSeed } from "@/lib/transfers/routes"

const comparisonSchema = z.object({
  mode: z.string(),
  typicalTime: z.string(),
  changes: z.string(),
  priceClarity: z.string(),
  highlight: z.boolean().optional(),
})

const faqSchema = z.object({
  question: z.string(),
  answer: z.string(),
})

const insightSchema = z.object({
  title: z.string(),
  body: z.string(),
})

const seedSchema = z.object({
  slug: z.string().trim().min(1).max(80),
  origin: z.string().trim().max(200),
  destinationName: z.string().trim().min(1).max(120),
  nameVariants: z.array(z.string().max(80)).max(12),
  destinationId: z.string().trim().max(60),
  zoneName: z.string().trim().max(120),
  distanceKm: z.number().min(0).max(2000),
  duration: z.object({
    minMinutes: z.number().min(0).max(24 * 60),
    maxMinutes: z.number().min(0).max(24 * 60),
    label: z.string().max(80),
  }),
  catalogPriceEur: z.number().min(0).max(10000),
  heroImageUrl: z.string().max(2000),
  travelDescription: z.string().max(8000),
  comparisonTable: z.array(comparisonSchema).max(12),
  routeFaqs: z.array(faqSchema).max(40),
  insights: z.array(insightSchema).max(20),
  relatedSlugs: z.array(z.string().max(80)).max(12),
})

function revalidateTransferPaths(routeSlug: string) {
  revalidateAllLocales("/transfers")
  revalidatePath(`/transfers/${routeSlug}`)
  revalidateAllLocales(`/transfers/${routeSlug}`)
  revalidatePath("/admin/transfers")
  revalidatePath(`/admin/transfers/${routeSlug}`)
}

type Params = { params: Promise<{ slug: string }> }

export async function GET(_request: Request, { params }: Params) {
  const denied = await requireAdmin()
  if (denied) return denied

  const { slug } = await params
  const transfer = await getAdminTransfer(slug)
  if (!transfer) {
    return NextResponse.json({ error: "Transfer not found." }, { status: 404 })
  }
  return NextResponse.json({ transfer })
}

export async function PUT(request: Request, { params }: Params) {
  const denied = await requireAdmin()
  if (denied) return denied

  const { slug } = await params
  const body = await request.json().catch(() => ({}))
  const seedBody =
    body && typeof body === "object" && "seed" in body
      ? (body as { seed: unknown }).seed
      : body

  const parsed = seedSchema.safeParse(seedBody)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid transfer payload.", details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  if (parsed.data.slug !== slug) {
    return NextResponse.json(
      { error: "Slug in body must match the URL." },
      { status: 400 },
    )
  }

  try {
    const seed = await saveTransferSeed(parsed.data as TransferRouteSeed)
    revalidateTransferPaths(slug)
    const transfer = await getAdminTransfer(slug)
    return NextResponse.json({ seed, transfer })
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || "Could not save transfer." },
      { status: 400 },
    )
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const denied = await requireAdmin()
  if (denied) return denied

  const { slug } = await params
  const existing = await getAdminTransfer(slug)
  if (!existing) {
    return NextResponse.json({ error: "Transfer not found." }, { status: 404 })
  }

  try {
    const result = await deleteOrResetTransfer(slug)
    revalidateTransferPaths(slug)
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || "Could not delete transfer." },
      { status: 400 },
    )
  }
}
