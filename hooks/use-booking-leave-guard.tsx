"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"

import { hasBookingProgress } from "@/lib/booking-progress"
import { stripLocalePrefix } from "@/lib/i18n/locales"
import { useT } from "@/lib/i18n/use-locale"
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
  const path = stripLocalePrefix(pathname)
  return path === "/" || path === "/book"
}

function shouldAllowWithoutPrompt(url: URL) {
  const path = stripLocalePrefix(url.pathname)
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
  const tr = useT()
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
          <AlertDialogTitle>{tr("book.leaveTitle")}</AlertDialogTitle>
          <AlertDialogDescription>
            {tr("book.leaveBody")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="h-11 rounded-full border border-border bg-brand-page px-5 text-sm font-bold text-brand shadow-none hover:bg-muted">
            {tr("book.leaveStay")}
          </AlertDialogCancel>
          <AlertDialogAction
            className="h-11 rounded-full bg-brand-accent px-5 text-sm font-extrabold text-white shadow-none hover:bg-brand-accent-hover"
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
            {tr("book.leaveConfirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )

  return { dialog }
}
