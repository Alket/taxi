import { Suspense } from "react"
import type { Metadata } from "next"

import { MyBookingView } from "@/components/booking/my-booking-view"
import { Skeleton } from "@/components/ui/skeleton"

export const metadata: Metadata = {
  title: "My booking",
  description: "Look up and manage your airport transfer without an account.",
}

export default function MyBookingPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-2xl p-6">
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      }
    >
      <MyBookingView />
    </Suspense>
  )
}
