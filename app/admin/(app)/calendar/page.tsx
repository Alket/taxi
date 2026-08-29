import { Suspense } from "react"

import { BookingsCalendarView } from "@/components/bookings/bookings-calendar-view"

export default function CalendarPage() {
  return (
    <Suspense>
      <BookingsCalendarView />
    </Suspense>
  )
}
