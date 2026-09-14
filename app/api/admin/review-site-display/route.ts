import { NextResponse } from "next/server"

import { requireStaffSession } from "@/lib/auth"
import { getSettingsRow, serializeSettings, SETTINGS_ID } from "@/lib/settings"
import { prisma } from "@/lib/db"
import {
  DEFAULT_TRUSTPILOT_DISCLAIMER,
  DEFAULT_TRUSTPILOT_PROFILE_URL,
  normalizeTrustpilotUrl,
  reviewSiteDisplaySchema,
} from "@/lib/trustpilot-testimonials"
import { revalidateAllLocales } from "@/lib/revalidate-locales"

/**
 * Staff-facing display settings for customer reviews + Trustpilot carousel.
 * Kept off the full admin-only /api/admin/settings surface so operators can toggle.
 */
export async function GET(request: Request) {
  const session = await requireStaffSession(request)
  if ("error" in session) return session.error

  try {
    const settings = serializeSettings(await getSettingsRow())
    return NextResponse.json({
      display: {
        customerReviewsVisibleOnSite: settings.customerReviewsVisibleOnSite,
        trustpilotTestimonialsVisibleOnSite:
          settings.trustpilotTestimonialsVisibleOnSite,
        trustpilotDisplayScore: settings.trustpilotDisplayScore,
        trustpilotDisplayCount: settings.trustpilotDisplayCount,
        trustpilotProfileUrl: settings.trustpilotProfileUrl,
        trustpilotDisclaimer: settings.trustpilotDisclaimer,
      },
    })
  } catch (error) {
    console.error("[review-site-display GET]", error)
    return NextResponse.json(
      { error: "Failed to load display settings." },
      { status: 500 },
    )
  }
}

export async function PATCH(request: Request) {
  const session = await requireStaffSession(request)
  if ("error" in session) return session.error

  const body = await request.json().catch(() => ({}))
  const parsed = reviewSiteDisplaySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid display settings.", details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const data: Record<string, unknown> = {}
  const input = parsed.data
  if (typeof input.customerReviewsVisibleOnSite === "boolean") {
    data.customerReviewsVisibleOnSite = input.customerReviewsVisibleOnSite
  }
  if (typeof input.trustpilotTestimonialsVisibleOnSite === "boolean") {
    data.trustpilotTestimonialsVisibleOnSite =
      input.trustpilotTestimonialsVisibleOnSite
  }
  if (typeof input.trustpilotDisplayScore === "number") {
    data.trustpilotDisplayScore = Number(input.trustpilotDisplayScore.toFixed(1))
  }
  if (typeof input.trustpilotDisplayCount === "number") {
    data.trustpilotDisplayCount = input.trustpilotDisplayCount
  }
  if (typeof input.trustpilotProfileUrl === "string") {
    data.trustpilotProfileUrl =
      normalizeTrustpilotUrl(input.trustpilotProfileUrl) ||
      DEFAULT_TRUSTPILOT_PROFILE_URL
  }
  if (typeof input.trustpilotDisclaimer === "string") {
    data.trustpilotDisclaimer =
      input.trustpilotDisclaimer.trim() || DEFAULT_TRUSTPILOT_DISCLAIMER
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json(
      { error: "No display fields to update." },
      { status: 400 },
    )
  }

  await getSettingsRow()
  const row = await prisma.settings.update({
    where: { id: SETTINGS_ID },
    data,
  })
  revalidateAllLocales("/")

  const settings = serializeSettings(row)
  return NextResponse.json({
    display: {
      customerReviewsVisibleOnSite: settings.customerReviewsVisibleOnSite,
      trustpilotTestimonialsVisibleOnSite:
        settings.trustpilotTestimonialsVisibleOnSite,
      trustpilotDisplayScore: settings.trustpilotDisplayScore,
      trustpilotDisplayCount: settings.trustpilotDisplayCount,
      trustpilotProfileUrl: settings.trustpilotProfileUrl,
      trustpilotDisclaimer: settings.trustpilotDisclaimer,
    },
  })
}
