"use client"

import * as React from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

import {
  maxReachableStep,
  parseBookingStep,
} from "@/lib/booking-progress"
import { isBookingLeaveGuardBypassed } from "@/hooks/use-booking-leave-guard"
import {
  canProceedToStep,
  useBookingStore,
  type BookingStep,
} from "@/lib/store/booking-store"

/** Step 1 is the default — keep the URL clean (`/` not `/?step=1`). */
function buildBookUrl(
  pathname: string,
  searchParams: URLSearchParams,
  step: BookingStep,
) {
  const params = new URLSearchParams(searchParams.toString())
  params.delete("payment")
  if (step <= 1) {
    params.delete("step")
  } else {
    params.set("step", String(step))
  }
  const qs = params.toString()
  return qs ? `${pathname}?${qs}` : pathname
}

function urlRepresentsStep(
  stepParam: string | null,
  step: BookingStep,
): boolean {
  // Step 1 must have no `step` query — strip `?step=1` if present.
  if (step <= 1) return stepParam == null
  return parseBookingStep(stepParam) === step
}

/**
 * Keeps Zustand `currentStep` in sync with `/?step=N` for step 2 (payment)
 * so browser back/forward and refresh restore progress. Step 1 omits the param.
 */
export function useBookingStepSync(hydrated: boolean) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const stepParam = searchParams.get("step")
  const currentStep = useBookingStore((s) => s.currentStep)
  const applyingUrl = React.useRef(false)
  const lastWrittenStep = React.useRef<BookingStep | null>(null)

  // URL → store (back/forward, deep links, refresh after rehydrate)
  React.useEffect(() => {
    if (!hydrated) return
    // Only sync on the wizard routes — never fight confirmation navigation.
    if (pathname !== "/book" && pathname !== "/") return
    if (isBookingLeaveGuardBypassed()) return

    const state = useBookingStore.getState()
    const requested = parseBookingStep(stepParam)
    const max = maxReachableStep(state)

    let target: BookingStep
    if (requested) {
      target = Math.min(requested, max) as BookingStep
    } else if (stepParam == null) {
      // Clean URL: stay on persisted step only if it's still step 1,
      // otherwise restore from draft when landing without a step param
      // after refresh — prefer max of persisted currentStep vs 1.
      target = state.currentStep
      if (target > max) target = max
    } else {
      target = 1
    }

    applyingUrl.current = true
    if (state.currentStep !== target) {
      useBookingStore.setState({ currentStep: target })
    }

    if (!urlRepresentsStep(stepParam, target)) {
      lastWrittenStep.current = target
      router.replace(buildBookUrl(pathname, searchParams, target), {
        scroll: false,
      })
    } else {
      lastWrittenStep.current = target
    }

    queueMicrotask(() => {
      applyingUrl.current = false
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, pathname, router, stepParam])

  // Store → URL (Continue / Back / step indicator)
  React.useEffect(() => {
    if (!hydrated || applyingUrl.current) return
    if (pathname !== "/book" && pathname !== "/") return
    // After a successful checkout we reset the draft and navigate to the
    // thank-you page — don't rewrite the URL back to /book.
    if (isBookingLeaveGuardBypassed()) return
    if (lastWrittenStep.current === currentStep) return

    if (urlRepresentsStep(stepParam, currentStep)) {
      lastWrittenStep.current = currentStep
      return
    }

    lastWrittenStep.current = currentStep
    router.push(buildBookUrl(pathname, searchParams, currentStep), {
      scroll: false,
    })
  }, [currentStep, hydrated, pathname, router, searchParams, stepParam])
}

export function useBookingWizardNav() {
  const nextStep = useBookingStore((s) => s.nextStep)
  const prevStep = useBookingStore((s) => s.prevStep)
  const setStep = useBookingStore((s) => s.setStep)
  const currentStep = useBookingStore((s) => s.currentStep)
  const canGoNext = useBookingStore((s) => {
    if (s.currentStep >= 2) return false
    return canProceedToStep(s, (s.currentStep + 1) as BookingStep)
  })

  const goNext = React.useCallback(() => nextStep(), [nextStep])
  const goPrev = React.useCallback(() => prevStep(), [prevStep])
  const goToStep = React.useCallback(
    (step: BookingStep) => setStep(step),
    [setStep],
  )

  return {
    currentStep,
    canGoNext,
    goNext,
    goPrev,
    goToStep,
  }
}
