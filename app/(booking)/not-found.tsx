import type { Metadata } from "next"

import { MarketingNotFoundContent } from "@/components/marketing/marketing-not-found"

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: true },
}

/** 404s under marketing/booking chrome (header + footer from layout). */
export default function BookingNotFound() {
  return <MarketingNotFoundContent />
}
