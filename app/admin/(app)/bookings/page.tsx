import { Suspense } from "react"

import { BookingsView } from "@/components/bookings/bookings-view"
import { Skeleton } from "@/components/ui/skeleton"

function BookingsFallback() {
  return (
    <div className="flex w-full flex-col gap-4 p-3 sm:p-4 md:p-6">
      <Skeleton className="h-28 w-full rounded-xl" />
      <Skeleton className="h-[28rem] w-full rounded-xl" />
    </div>
  )
}

export default function BookingsPage() {
  return (
    <Suspense fallback={<BookingsFallback />}>
      <BookingsView />
    </Suspense>
  )
}
