import { Suspense } from "react"
import type { Metadata } from "next"

import { ReviewFormView } from "@/components/booking/review-form-view"
import { Skeleton } from "@/components/ui/skeleton"

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default function ReviewPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto w-full max-w-lg px-4 py-10">
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      }
    >
      <ReviewFormView />
    </Suspense>
  )
}
