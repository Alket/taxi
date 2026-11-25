import { Suspense } from "react"

import { BookingsCalendarView } from "@/components/bookings/bookings-calendar-view"
import { Skeleton } from "@/components/ui/skeleton"

function CalendarFallback() {
  return (
    <div className="flex w-full flex-col gap-4 p-3 sm:p-4 md:p-6">
      <Skeleton className="h-28 w-full rounded-xl" />
      <Skeleton className="h-[32rem] w-full rounded-xl" />
    </div>
  )
}

export default function CalendarPage() {
  return (
    <Suspense fallback={<CalendarFallback />}>
      <BookingsCalendarView />
    </Suspense>
  )
}
