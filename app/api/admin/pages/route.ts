import { revalidatePath } from "next/cache"
import { NextResponse } from "next/server"
import { z } from "zod"

import { requireAdmin } from "@/lib/auth"
import {
  createDestinationPage,
  listAdminPages,
} from "@/lib/page-content"

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  id: z.string().trim().max(60).optional(),
  region: z.string().trim().max(120).optional(),
  description: z.string().trim().max(2000).optional(),
  badge: z.string().trim().max(60).optional(),
  priceFrom: z.string().trim().max(40).optional(),
  image: z.string().trim().max(2000).optional(),
})

export async function GET() {
  const denied = await requireAdmin()
  if (denied) return denied

  const pages = await listAdminPages()
  return NextResponse.json({ pages })
}

/** Create a new destination marketing page. */
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
    const page = await createDestinationPage(parsed.data)
    revalidatePath("/")
    revalidatePath("/destinations")
    revalidatePath("/destinations/[slug]", "page")
    revalidatePath("/admin/pages")
    return NextResponse.json({ page }, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || "Could not create destination." },
      { status: 400 },
    )
  }
}
