import { NextResponse } from "next/server"

import { takeRateLimit } from "@/lib/rate-limit"
import { getSettings } from "@/lib/settings"
import { clientIpFromRequest } from "@/lib/trustpilot-testimonials"

/** Public flags for whether review sections should render on marketing pages. */
export async function GET(request: Request) {
  const limited = takeRateLimit(
    `reviews-site-display:${clientIpFromRequest(request)}`,
    120,
    60_000,
  )
  if (!limited.ok) {
    return NextResponse.json(
      {
        customerReviewsVisibleOnSite: true,
        trustpilotTestimonialsVisibleOnSite: false,
      },
      {
        status: 429,
        headers: { "Retry-After": String(limited.retryAfterSec) },
      },
    )
  }

  try {
    const settings = await getSettings()
    return NextResponse.json({
      customerReviewsVisibleOnSite: settings.customerReviewsVisibleOnSite,
      trustpilotTestimonialsVisibleOnSite:
        settings.trustpilotTestimonialsVisibleOnSite,
    })
  } catch {
    return NextResponse.json({
      customerReviewsVisibleOnSite: true,
      trustpilotTestimonialsVisibleOnSite: false,
    })
  }
}
