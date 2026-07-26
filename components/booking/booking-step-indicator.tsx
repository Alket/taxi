"use client"

import { CheckIcon } from "lucide-react"

import { useBookingStore, type BookingStep } from "@/lib/store/booking-store"
import { cn } from "@/lib/utils"

const STEPS: { step: BookingStep; label: string }[] = [
  { step: 1, label: "Details" },
  { step: 2, label: "Payment" },
]

export function BookingStepIndicator() {
  const currentStep = useBookingStore((s) => s.currentStep)

  return (
    <nav aria-label="Booking progress" className="w-full">
      <ol className="flex items-center">
        {STEPS.map(({ step, label }, index) => {
          const complete = currentStep > step
          const active = currentStep === step
          const isLast = index === STEPS.length - 1

          return (
            <li
              key={step}
              className={cn("flex items-center", !isLast && "min-w-0 flex-1")}
            >
              <div className="flex items-center gap-2.5 sm:gap-3">
                <span
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors sm:size-9 sm:text-sm",
                    complete && "bg-brand-accent text-white",
                    active &&
                      "bg-brand-accent text-white ring-4 ring-brand-accent/20",
                    !complete &&
                      !active &&
                      "border border-border bg-brand-surface text-muted-foreground",
                  )}
                  aria-current={active ? "step" : undefined}
                >
                  {complete ? (
                    <CheckIcon className="size-3.5 sm:size-4" strokeWidth={2.5} />
                  ) : (
                    step
                  )}
                </span>
                <span
                  className={cn(
                    "text-sm font-bold tracking-tight sm:text-[15px]",
                    active || complete ? "text-brand" : "text-muted-foreground",
                  )}
                >
                  {label}
                </span>
              </div>

              {!isLast && (
                <div
                  className="mx-3 h-0.5 min-w-6 flex-1 rounded-full bg-border sm:mx-5"
                  aria-hidden
                >
                  <div
                    className={cn(
                      "h-full rounded-full bg-brand-accent transition-all duration-300",
                      complete ? "w-full" : "w-0",
                    )}
                  />
                </div>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
