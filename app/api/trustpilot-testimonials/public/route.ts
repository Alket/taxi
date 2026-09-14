import { NextResponse } from "next/server"

import { takeRateLimit } from "@/lib/rate-limit"
import { getSettings } from "@/lib/settings"
import {
  clientIpFromRequest,
  DEFAULT_TRUSTPILOT_DISCLAIMER,
  DEFAULT_TRUSTPILOT_PROFILE_URL,
  listPublishedTrustpilotTestimonials,
  normalizeTrustpilotUrl,
  serializePublicTrustpilotTestimonial,
} from "@/lib/trustpilot-testimonials"

export async function GET(request: Request) {
  const limited = takeRateLimit(
    `tp-public:${clientIpFromRequest(request)}`,
    60,
    60_000,
  )
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests. Try again shortly." },
      {
        status: 429,
        headers: { "Retry-After": String(limited.retryAfterSec) },
      },
    )
  }

  try {
    const settings = await getSettings()
    if (!settings.trustpilotTestimonialsVisibleOnSite) {
      return NextResponse.json({
        visible: false,
        summary: null,
        testimonials: [],
      })
    }

    const rows = await listPublishedTrustpilotTestimonials()
    const profileUrl =
      normalizeTrustpilotUrl(settings.trustpilotProfileUrl) ||
      DEFAULT_TRUSTPILOT_PROFILE_URL

    return NextResponse.json({
      visible: true,
      summary: {
        score: settings.trustpilotDisplayScore,
        count: settings.trustpilotDisplayCount,
        profileUrl,
        disclaimer:
          settings.trustpilotDisclaimer?.trim() || DEFAULT_TRUSTPILOT_DISCLAIMER,
      },
      testimonials: rows.map(serializePublicTrustpilotTestimonial),
    })
  } catch (error) {
    console.error("[trustpilot-public]", error)
    return NextResponse.json(
      { error: "Failed to load Trustpilot testimonials." },
      { status: 500 },
    )
  }
}
