"use client"

import * as React from "react"
import useSWR from "swr"
import { toast } from "sonner"
import {
  ChevronRightIcon,
  ChevronUpIcon,
} from "lucide-react"

import { fetcher } from "@/lib/api"
import { formatMoney } from "@/lib/format"
import {
  useBookingStore,
  type BookingStep,
} from "@/lib/store/booking-store"
import {
  useBookingStepSync,
  useBookingWizardNav,
} from "@/hooks/use-booking-step-sync"
import { useBookingLeaveGuard, enableBookingLeaveGuard } from "@/hooks/use-booking-leave-guard"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { BookingHeaderBenefits } from "@/components/booking/booking-header-benefits"
import { BookingStepIndicator } from "@/components/booking/booking-step-indicator"
import {
  BookingSummaryContent,
  BookingSummaryPanel,
} from "@/components/booking/booking-summary-panel"
import { RouteStep } from "@/components/booking/steps/RouteStep"
import { DetailsStep } from "@/components/booking/steps/DetailsStep"
import { PaymentStep } from "@/components/booking/steps/PaymentStep"
import { MARKETING_CONTAINER } from "@/components/marketing/marketing-container"
import { cn } from "@/lib/utils"

import { getFirstInvalidBookingField } from "@/lib/booking-validation"
import { dispatchBookingFieldFocus } from "@/lib/booking-field-focus"

const STEP_META: Record<
  BookingStep,
  { title: string; description: string }
> = {
  1: {
    title: "Booking details",
    description: "Route, passengers, and your contact details.",
  },
  2: {
    title: "Payment",
    description: "Pay your deposit to confirm the transfer.",
  },
}

function MobileSummaryBar({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const quotedPrice = useBookingStore((s) => s.quotedPrice)
  const vehicleQuotes = useBookingStore((s) => s.vehicleQuotes)
  const quoteStatus = useBookingStore((s) => s.quoteStatus)
  const infantCarrierCount = useBookingStore((s) => s.infantCarrierCount)
  const childSeatCount = useBookingStore((s) => s.childSeatCount)
  const boosterCount = useBookingStore((s) => s.boosterCount)
  const createdBookingId = useBookingStore((s) => s.createdBookingId)
  const { data: seatConfig } = useSWR<{
    infantCarrierPrice?: number
    childSeatPrice?: number
    boosterSeatPrice?: number
  }>("/api/booking/config", fetcher)

  const seatAddon =
    createdBookingId
      ? 0
      : (infantCarrierCount * (seatConfig?.infantCarrierPrice ?? 0) +
          childSeatCount * (seatConfig?.childSeatPrice ?? 0) +
          boosterCount * (seatConfig?.boosterSeatPrice ?? 0))

  const fromPrice = Object.values(vehicleQuotes)
    .map((q) => q?.price)
    .filter((price): price is number => typeof price === "number")
  const basePrice =
    quotedPrice ?? (fromPrice.length > 0 ? Math.min(...fromPrice) : null)
  const mobilePrice =
    basePrice == null ? null : Number((basePrice + seatAddon).toFixed(2))

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur supports-backdrop-filter:bg-background/80 md:hidden">
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetTrigger
          render={
            <button
              type="button"
              className="mx-auto flex w-full max-w-[1280px] items-center justify-between gap-3 rounded-xl border bg-brand-surface px-3.5 py-2.5 text-left shadow-sm transition-colors hover:bg-muted/40"
              aria-expanded={open}
            />
          }
        >
          <div className="min-w-0">
            <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              {quotedPrice !== null ? "Estimated total" : "From"}
            </p>
            {quoteStatus === "loading" ? (
              <Skeleton className="mt-1 h-6 w-20" />
            ) : (
              <p className="text-lg font-semibold tabular-nums">
                {mobilePrice === null ? "—" : formatMoney(mobilePrice)}
              </p>
            )}
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-muted-foreground">
            Summary
            <ChevronUpIcon className="size-4" aria-hidden />
          </span>
        </SheetTrigger>
        <SheetContent
          side="bottom"
          className="max-h-[min(85vh,40rem)] gap-0 rounded-t-2xl pb-[env(safe-area-inset-bottom)]"
        >
          <SheetHeader className="border-b pb-3 text-left">
            <SheetTitle>Trip summary</SheetTitle>
          </SheetHeader>
          <div className="overflow-y-auto overscroll-contain p-4">
            <BookingSummaryContent />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}

export function BookingShell({
  variant = "page",
}: {
  /** `hero` hides the page title and tightens chrome for the homepage. */
  variant?: "page" | "hero"
}) {
  const [hydrated, setHydrated] = React.useState(false)
  const [summaryOpen, setSummaryOpen] = React.useState(false)
  const isHero = variant === "hero"

  React.useEffect(() => {
    const result = useBookingStore.persist.rehydrate()
    void Promise.resolve(result).finally(() => {
      enableBookingLeaveGuard()
      setHydrated(true)
    })
  }, [])

  useBookingStepSync(hydrated)
  const { dialog: leaveDialog } = useBookingLeaveGuard(hydrated)
  const { currentStep, canGoNext, goNext } = useBookingWizardNav()

  const meta = STEP_META[currentStep]
  const startedFromHero = useBookingStore((s) => s.startedFromHero)
  const stepTitle =
    currentStep === 1 && startedFromHero ? "Complete your booking" : meta.title

  function handleContinue() {
    const state = useBookingStore.getState()
    const invalid = getFirstInvalidBookingField(state)

    if (invalid) {
      toast.error(invalid.message)
      dispatchBookingFieldFocus({
        field: invalid.field,
        message: invalid.message,
      })
      return
    }

    if (!canGoNext) {
      toast.error("Please complete all required fields.")
      return
    }

    goNext()
  }

  if (!hydrated) {
    return (
      <div
        className={
          isHero
            ? "flex w-full flex-col gap-4"
            : cn(MARKETING_CONTAINER, "flex flex-col gap-6 py-6 md:py-10")
        }
      >
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-72 w-full rounded-xl" />
      </div>
    )
  }

  return (
    <div
      className={
        isHero
          ? "flex w-full flex-col gap-4 pb-24 md:pb-0"
          : cn(
              MARKETING_CONTAINER,
              "flex flex-col gap-6 py-6 pb-28 md:pb-10",
            )
      }
    >
      {leaveDialog}

      <header className="flex flex-col gap-6">
        <div className="flex items-center justify-between border-b pb-4">
          <BookingStepIndicator />
          <div className="hidden items-center gap-6 text-[13px] font-medium text-muted-foreground md:flex">
            <span>EN</span>
            <span>€</span>
            <button type="button" className="hover:text-brand">
              Help
            </button>
          </div>
        </div>
        {!isHero && <BookingHeaderBenefits />}
      </header>

      <div
        className={
          isHero
            ? "grid gap-4 lg:grid-cols-[minmax(0,1fr)_16rem]"
            : "grid gap-6 md:grid-cols-[minmax(0,1fr)_18rem] lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_22rem]"
        }
      >
        <section className="flex min-w-0 flex-col gap-4 md:gap-6">
          <div
            className={
              isHero
                ? "rounded-2xl border border-black/5 bg-brand-surface p-4 text-brand shadow-sm sm:p-5"
                : "rounded-xl border-0 bg-brand-surface p-6 shadow-sm"
            }
          >
            {!isHero && (
              <h2 className="mb-6 text-2xl font-bold tracking-tight text-brand">
                {stepTitle}
              </h2>
            )}

            {currentStep === 1 ? (
              <div className="flex flex-col gap-10">
                <RouteStep />
                <div className={startedFromHero ? undefined : "border-t pt-8"}>
                  {!startedFromHero && (
                    <h3 className="mb-6 text-lg font-bold tracking-tight text-brand">
                      Your details
                    </h3>
                  )}
                  <DetailsStep />
                </div>
                {!isHero && (
                  <Button
                    type="button"
                    size="lg"
                    className="h-12 w-full rounded-xl font-extrabold bg-brand-accent text-white hover:bg-brand-accent-hover"
                    onClick={handleContinue}
                  >
                    Continue
                    <ChevronRightIcon data-icon="inline-end" />
                  </Button>
                )}
              </div>
            ) : (
              <PaymentStep />
            )}
          </div>

          {currentStep < 2 && isHero && (
            <div className="flex items-center justify-end gap-3">
              <Button
                type="button"
                className="rounded font-extrabold bg-brand-accent text-white hover:bg-brand-accent-hover"
                onClick={handleContinue}
              >
                Continue
                <ChevronRightIcon data-icon="inline-end" />
              </Button>
            </div>
          )}
        </section>

        <div className={isHero ? "hidden lg:block" : "hidden md:block"}>
          <BookingSummaryPanel
            className={isHero ? "border-black/5 bg-brand-surface shadow-sm" : undefined}
          />
        </div>
      </div>

      <MobileSummaryBar open={summaryOpen} onOpenChange={setSummaryOpen} />
    </div>
  )
}
