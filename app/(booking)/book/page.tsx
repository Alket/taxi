import { Suspense } from "react"

import { BookingShell } from "@/components/booking/booking-shell"
import { MARKETING_CONTAINER } from "@/components/marketing/marketing-container"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

function BookPageFallback() {
  return (
    <div className={cn(MARKETING_CONTAINER, "flex flex-col gap-6 py-6 md:py-10")}>
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
