import { Suspense } from "react"
import { BookingsView } from "@/components/bookings/bookings-view"

export default function BookingsPage() {
  return (
    <Suspense>
      <BookingsView />
    </Suspense>
  )
}
