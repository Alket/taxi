"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"

import { hasBookingProgress } from "@/lib/booking-progress"
import { useBookingStore } from "@/lib/store/booking-store"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

let leaveGuardBypass = false

/** Call before intentional exits (payment success, PayPal redirect, confirmed leave). */
export function bypassBookingLeaveGuard() {
  leaveGuardBypass = true
}

/** Re-enable the guard when re-entering the booking wizard. */
export function enableBookingLeaveGuard() {
  leaveGuardBypass = false
}

export function isBookingLeaveGuardBypassed() {
  return leaveGuardBypass
}

function isBookingFlowPath(pathname: string) {
  return pathname === "/" || pathname === "/book"
}

function shouldAllowWithoutPrompt(url: URL) {
  const path = url.pathname
  if (path.startsWith("/book/confirmation")) return true
  if (path.startsWith("/book/payment")) return true
  if (path === "/" || path === "/book") return true
  return false
}

/**
 * Warns before abandoning an in-progress booking (tab close + in-app links).
 */
export function useBookingLeaveGuard(enabled: boolean) {
  const router = useRouter()
  const pathname = usePathname()
  const [pendingHref, setPendingHref] = React.useState<string | null>(null)

  const dirty = useBookingStore((s) => hasBookingProgress(s))
  const active =
    enabled && dirty && !leaveGuardBypass && isBookingFlowPath(pathname)

  React.useEffect(() => {
    if (!active) return

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (leaveGuardBypass) return
      event.preventDefault()
      event.returnValue = ""
    }

    window.addEventListener("beforeunload", onBeforeUnload)
    return () => window.removeEventListener("beforeunload", onBeforeUnload)
  }, [active])

  React.useEffect(() => {
    if (!active) return

    const onDocumentClick = (event: MouseEvent) => {
      if (leaveGuardBypass) return
      if (event.defaultPrevented) return
      if (event.button !== 0) return
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return
      }

      const target = event.target as HTMLElement | null
      const anchor = target?.closest?.("a[href]") as HTMLAnchorElement | null
      if (!anchor) return
      if (anchor.target === "_blank" || anchor.hasAttribute("download")) return

      const href = anchor.getAttribute("href")
      if (!href || href.startsWith("#")) return

      let url: URL
      try {
        url = new URL(href, window.location.origin)
      } catch {
        return
      }

      if (url.origin !== window.location.origin) {
        event.preventDefault()
        event.stopPropagation()
        setPendingHref(url.href)
        return
      }

      if (shouldAllowWithoutPrompt(url)) return

      event.preventDefault()
      event.stopPropagation()
      setPendingHref(`${url.pathname}${url.search}${url.hash}`)
    }

    document.addEventListener("click", onDocumentClick, true)
    return () => document.removeEventListener("click", onDocumentClick, true)
  }, [active])

  const dialog = (
    <AlertDialog
      open={pendingHref !== null}
      onOpenChange={(open) => {
        if (!open) setPendingHref(null)
      }}
    >
      <AlertDialogContent size="default" className="max-w-md sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>Leave this booking?</AlertDialogTitle>
          <AlertDialogDescription>
            Your progress is saved in this browser tab for now, but leaving may
            make it harder to finish checkout. Are you sure you want to leave?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Stay</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              if (!pendingHref) return
              const href = pendingHref
              setPendingHref(null)
              bypassBookingLeaveGuard()
              if (href.startsWith("http")) {
                window.location.href = href
              } else {
                router.push(href)
              }
            }}
          >
            Leave
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )

  return { dialog }
}
