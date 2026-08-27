import type { Metadata } from "next"

import { MarketingNotFoundContent } from "@/components/marketing/marketing-not-found"

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: true },
}

/** Global unmatched URLs (outside route groups that define their own not-found). */
export default function GlobalNotFound() {
  return <MarketingNotFoundContent withChrome />
}
