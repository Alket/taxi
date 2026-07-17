import { Suspense } from "react"

import { BookingShell } from "@/components/booking/booking-shell"
import { Skeleton } from "@/components/ui/skeleton"

function BookPageFallback() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 md:px-6 md:py-10 lg:px-8">
      <Skeleton className="h-10 w-48" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-72 w-full rounded-xl" />
    </div>
  )
}

export default function BookPage() {
  return (
    <Suspense fallback={<BookPageFallback />}>
      <BookingShell />
    </Suspense>
  )
}
