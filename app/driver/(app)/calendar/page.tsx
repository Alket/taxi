import { Suspense } from "react"

import { DriverCalendarView } from "@/components/driver/driver-calendar-view"

export default function DriverCalendarPage() {
  return (
    <Suspense>
      <DriverCalendarView />
    </Suspense>
  )
}
