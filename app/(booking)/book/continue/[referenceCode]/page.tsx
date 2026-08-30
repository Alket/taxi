import { Suspense } from "react"

import ContinueBookingPage from "./continue-client"
import { Skeleton } from "@/components/ui/skeleton"

function Fallback() {
  return (
    <div className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center gap-3 px-4 py-16">
      <Skeleton className="h-6 w-48" />
      <Skeleton className="h-4 w-64" />
    </div>
  )
}

export default function ContinueBookingRoute() {
  return (
    <Suspense fallback={<Fallback />}>
      <ContinueBookingPage />
    </Suspense>
  )
}
