import { revalidatePath } from "next/cache"
import { NextResponse } from "next/server"
import { z } from "zod"

import { requireAdmin } from "@/lib/auth"
import { LOCALES, isLocale, type Locale } from "@/lib/i18n/locales"
import { listAdminPages } from "@/lib/page-content"
import {
  I18N_MAX_BODY_BYTES,
  exportPageI18nPack,
  importPageI18nPack,
} from "@/lib/page-content-i18n-pack"
import { revalidateAllLocales } from "@/lib/revalidate-locales"

/**
 * GET  — download a translation pack (all pages + destinations × locales).
 * POST — upload the same JSON after translators fill in locales.
 */
export async function GET() {
  const denied = await requireAdmin()
  if (denied) return denied

  const pack = await exportPageI18nPack()
  const stamp = new Date().toISOString().slice(0, 10)
  const filename = `landed-pages-i18n-${stamp}.json`

  return new NextResponse(JSON.stringify(pack, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  })
}

const importSchema = z.object({
  pack: z.unknown(),
  locales: z.array(z.string().max(8)).max(LOCALES.length).optional(),
})

export async function POST(request: Request) {
  const denied = await requireAdmin()
  if (denied) return denied

  const contentLength = Number(request.headers.get("content-length") || 0)
  if (contentLength > I18N_MAX_BODY_BYTES) {
    return NextResponse.json(
      {
        error: `Import payload too large (max ${Math.floor(I18N_MAX_BODY_BYTES / 1_000_000)}MB).`,
      },
      { status: 413 },
    )
  }

  const rawText = await request.text().catch(() => "")
  if (rawText.length > I18N_MAX_BODY_BYTES) {
    return NextResponse.json(
      {
        error: `Import payload too large (max ${Math.floor(I18N_MAX_BODY_BYTES / 1_000_000)}MB).`,
      },
      { status: 413 },
    )
  }

  let json: unknown = null
  try {
    json = rawText ? JSON.parse(rawText) : null
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
  }

  const parsed = importSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Send JSON body: { pack: <exported file>, locales?: string[] }" },
      { status: 400 },
    )
  }

  const locales = (parsed.data.locales ?? []).filter(isLocale) as Locale[]

  try {
    const result = await importPageI18nPack(parsed.data.pack, {
      locales: locales.length > 0 ? locales : [...LOCALES],
    })

    revalidateAllLocales("/")
    revalidateAllLocales("/destinations")
    revalidateAllLocales("/blog")
    revalidateAllLocales("/cancellation-policy")
    revalidateAllLocales("/privacy-policy")
    revalidateAllLocales("/terms")
    revalidateAllLocales("/cookies")
    revalidatePath("/admin/pages")
    revalidatePath("/blog/[slug]", "page")
    revalidatePath("/destinations/[slug]", "page")

    const pages = await listAdminPages().catch(() => [])
    for (const page of pages) {
      if (page.isDestination || page.isBlog || page.slug === "blog") {
        revalidateAllLocales(page.path)
      }
    }

    return NextResponse.json({
      ok: true,
      ...result,
      warning:
        result.errors.length > 0
          ? "Some pages were skipped — see errors."
          : undefined,
    })
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || "Import failed." },
      { status: 400 },
    )
  }
}
