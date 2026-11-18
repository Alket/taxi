import { Suspense } from "react"

import { BookingShell } from "@/components/booking/booking-shell"
import { MARKETING_CONTAINER } from "@/components/marketing/marketing-container"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

function BookPageFallback() {
  return (
    <div className={cn(MARKETING_CONTAINER, "flex flex-col gap-6 py-8 pb-28 md:pb-12")}>
      <div className="flex items-center justify-between gap-4 py-2">
        <Skeleton className="h-9 w-32 rounded-full" />
        <Skeleton className="h-9 w-32 rounded-full" />
      </div>
      <Skeleton className="h-14 w-full rounded-2xl" />
      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_18rem] lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Skeleton className="h-96 w-full rounded-2xl" />
        <Skeleton className="hidden h-96 w-full rounded-2xl md:block" />
      </div>
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
