"use client"

import { Suspense, useEffect, useRef, useState } from "react"
import { usePathname, useSearchParams } from "next/navigation"

function RouteProgressBarInner() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const routeKey = `${pathname}?${searchParams.toString()}`

  const [state, setState] = useState<"idle" | "loading" | "finishing">("idle")
  const [scale, setScale] = useState(0)
  const prevRoute = useRef(routeKey)
  const trickleTimer = useRef<number | null>(null)
  const finishTimer = useRef<number | null>(null)
  const safetyTimer = useRef<number | null>(null)

  const clearTimers = () => {
    if (trickleTimer.current !== null) {
      window.clearInterval(trickleTimer.current)
      trickleTimer.current = null
    }
    if (finishTimer.current !== null) {
      window.clearTimeout(finishTimer.current)
      finishTimer.current = null
    }
    if (safetyTimer.current !== null) {
      window.clearTimeout(safetyTimer.current)
      safetyTimer.current = null
    }
  }

  // Complete the bar as soon as Next.js commits the new route.
  useEffect(() => {
    if (prevRoute.current === routeKey) return
    prevRoute.current = routeKey

    clearTimers()
    if (state === "idle") return

    setScale(1)
    setState("finishing")
    finishTimer.current = window.setTimeout(() => {
      setState("idle")
      setScale(0)
    }, 240)
  }, [routeKey, state])

  // Start the bar on real internal <a href> navigations (never on initial SSR load).
  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return
      }

      const target = event.target as HTMLElement | null
      const anchor = target?.closest("a[href]") as HTMLAnchorElement | null
      if (!anchor) return
      if (anchor.target && anchor.target !== "_self") return
      if (anchor.hasAttribute("download")) return

      const href = anchor.getAttribute("href")
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) {
        return
      }

      let url: URL
      try {
        url = new URL(anchor.href, window.location.href)
      } catch {
        return
      }

      if (url.origin !== window.location.origin) return
      if (
        url.pathname === window.location.pathname &&
        url.search === window.location.search
      ) {
        return
      }

      clearTimers()
      setState("loading")
      setScale(0.18)

      trickleTimer.current = window.setInterval(() => {
        setScale((prev) => {
          if (prev >= 0.88) return prev
          const step = (0.9 - prev) * 0.18
          return Math.min(0.88, prev + Math.max(0.02, step))
        })
      }, 220)

      safetyTimer.current = window.setTimeout(() => {
        clearTimers()
        setState("idle")
        setScale(0)
      }, 8000)
    }

    document.addEventListener("click", onClick, { capture: true })
    return () => {
      document.removeEventListener("click", onClick, { capture: true })
      clearTimers()
    }
  }, [])

  if (state === "idle") return null

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-0 z-[250] h-[2.5px] overflow-hidden"
    >
      <div
        className="h-full w-full origin-left bg-brand-accent transition-[transform,opacity] duration-200 ease-out"
        style={{
          transform: `scaleX(${scale})`,
          opacity: state === "finishing" ? 0 : 1,
        }}
      />
    </div>
  )
}

/**
 * Lightweight 2.5px top navigation bar for client-side route transitions.
 * Renders null on SSR / initial load so LCP, Speed Index, and SEO are untouched.
 */
export function RouteProgressBar() {
  return (
    <Suspense fallback={null}>
      <RouteProgressBarInner />
    </Suspense>
  )
}
