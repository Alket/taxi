import { Suspense } from "react"

import { ReviewsView } from "@/components/admin/reviews-view"

export default function ReviewsPage() {
  return (
    <Suspense>
      <ReviewsView />
    </Suspense>
  )
}
