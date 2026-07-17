"use client"

import { useBookingStore } from "@/lib/store/booking-store"
import { cn } from "@/lib/utils"

export function BookingStepIndicator() {
  const currentStep = useBookingStore((s) => s.currentStep)

  const isTransfers = currentStep === 1
  const isPayment = currentStep === 2

  return (
    <nav
      aria-label="Booking progress"
      className="mx-auto flex w-fit items-center gap-4"
    >
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "flex size-5 items-center justify-center rounded-full text-[10px] font-bold",
            isTransfers
              ? "bg-brand-accent text-white"
              : "bg-muted text-muted-foreground",
          )}
        >
          1
        </span>
        <span
          className={cn(
            "text-[11px] font-bold tracking-wider uppercase",
            isTransfers ? "text-brand" : "text-muted-foreground",
          )}
        >
          Transfers
        </span>
      </div>

      <div className="h-px w-8 bg-muted-foreground/20" />

      <div className="flex items-center gap-2">
        <span
          className={cn(
            "flex size-5 items-center justify-center rounded-full text-[10px] font-bold",
            isPayment
              ? "bg-brand-accent text-white"
              : "bg-muted text-muted-foreground",
          )}
        >
          2
        </span>
        <span
          className={cn(
            "text-[11px] font-bold tracking-wider uppercase",
            isPayment ? "text-brand" : "text-muted-foreground",
          )}
        >
          Payment
        </span>
      </div>
    </nav>
  )
}
