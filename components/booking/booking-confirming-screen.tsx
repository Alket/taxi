"use client"

import { CheckCircle2Icon, Loader2Icon } from "lucide-react"

import { cn } from "@/lib/utils"

/** Full-viewport preloader used between checkout submit and the thank-you page. */
export function BookingConfirmingScreen({
  className,
  message = "Confirming your booking…",
}: {
  className?: string
  message?: string
}) {
  return (
    <div
      className={cn(
        "fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4 bg-brand-page px-6 text-center font-brand text-brand",
        className,
      )}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="relative flex size-16 items-center justify-center">
        <Loader2Icon className="size-12 animate-spin text-brand-accent" />
        <CheckCircle2Icon className="absolute size-5 text-brand-accent" />
      </div>
      <div>
        <p className="text-lg font-bold tracking-tight">{message}</p>
        <p className="mt-1 text-sm font-semibold text-muted-foreground">
          Please wait a moment.
        </p>
      </div>
    </div>
  )
}
