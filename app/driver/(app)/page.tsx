import { Suspense } from "react"

import { DriverDashboardView } from "@/components/driver/driver-dashboard-view"
import { Skeleton } from "@/components/ui/skeleton"

export default function DriverDashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 p-4 md:p-6">
          <Skeleton className="h-14 w-full rounded-xl" />
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-11 w-full rounded-lg" />
          <div className="grid gap-3 xl:grid-cols-2">
            <Skeleton className="h-36 w-full rounded-xl" />
            <Skeleton className="h-36 w-full rounded-xl" />
          </div>
        </div>
      }
    >
      <DriverDashboardView />
    </Suspense>
  )
}
