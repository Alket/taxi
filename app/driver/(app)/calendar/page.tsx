import { Suspense } from "react"

import { DriverCalendarView } from "@/components/driver/driver-calendar-view"
import { Skeleton } from "@/components/ui/skeleton"

function DriverCalendarFallback() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-3 sm:p-4 md:p-6">
      <Skeleton className="h-24 w-full rounded-xl" />
      <Skeleton className="h-[32rem] w-full rounded-xl" />
    </div>
  )
}

export default function DriverCalendarPage() {
  return (
    <Suspense fallback={<DriverCalendarFallback />}>
      <DriverCalendarView />
    </Suspense>
  )
}
