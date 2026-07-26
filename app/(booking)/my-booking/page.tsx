import { Suspense } from "react"
import type { Metadata } from "next"

import { MyBookingView } from "@/components/booking/my-booking-view"
import { MarketingContainer } from "@/components/marketing/marketing-container"
import { Skeleton } from "@/components/ui/skeleton"

export const metadata: Metadata = {
  title: "My booking",
  description: "Look up and manage your airport transfer without an account.",
}

function MyBookingFallback() {
  return (
    <div>
      <div className="-mt-24 h-[min(48svh,26rem)] min-h-[18rem] bg-brand-panel md:h-[min(44svh,30rem)]" />
      <MarketingContainer className="py-10 md:py-14">
        <div className="mx-auto max-w-3xl">
          <Skeleton className="h-64 w-full rounded-3xl" />
        </div>
      </MarketingContainer>
    </div>
  )
}

export default function MyBookingPage() {
  return (
    <Suspense fallback={<MyBookingFallback />}>
      <MyBookingView />
    </Suspense>
  )
}
