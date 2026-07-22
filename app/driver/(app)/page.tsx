import { Suspense } from "react"

import { DriverDashboardView } from "@/components/driver/driver-dashboard-view"
import { Skeleton } from "@/components/ui/skeleton"

export default function DriverDashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col gap-4 p-4">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      }
    >
      <DriverDashboardView />
    </Suspense>
  )
}
