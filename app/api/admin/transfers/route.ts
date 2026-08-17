import { revalidatePath } from "next/cache"
import { NextResponse } from "next/server"
import { z } from "zod"

import { requireAdmin } from "@/lib/auth"
import { revalidateAllLocales } from "@/lib/revalidate-locales"
import {
  createTransferSeed,
  listAdminTransfers,
} from "@/lib/transfers/cms"

const createSchema = z.object({
  destinationName: z.string().trim().min(1).max(120),
  slug: z.string().trim().max(80).optional(),
  zoneName: z.string().trim().max(120).optional(),
  destinationId: z.string().trim().max(60).optional(),
})

function revalidateTransferPaths(routeSlug?: string) {
  revalidateAllLocales("/transfers")
  if (routeSlug) {
    revalidatePath(`/transfers/${routeSlug}`)
    revalidateAllLocales(`/transfers/${routeSlug}`)
  }
  revalidatePath("/admin/transfers")
}

export async function GET() {
  const denied = await requireAdmin()
  if (denied) return denied

  const transfers = await listAdminTransfers()
  return NextResponse.json({ transfers })
}

export async function POST(request: Request) {
  const denied = await requireAdmin()
  if (denied) return denied

  const body = await request.json().catch(() => ({}))
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Provide at least a destination name." },
      { status: 400 },
    )
  }

  try {
    const seed = await createTransferSeed(parsed.data)
    revalidateTransferPaths(seed.slug)
    return NextResponse.json({ seed }, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || "Could not create transfer." },
      { status: 400 },
    )
  }
}
