"use client"

import { useEffect, useRef, type ReactNode } from "react"
import { usePathname } from "next/navigation"

import { cn } from "@/lib/utils"

/**
 * Soft fade/slide-in when navigating between marketing routes.
 * Skips initial SSR paint so LCP is never delayed by opacity: 0.
 * Pair with app/(booking)/template.tsx so the shell (header/footer) stays put.
 */
export function MarketingPageEnter({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  const pathname = usePathname()
  const initialPath = useRef(pathname)
  const isRouteTransition = pathname !== initialPath.current

  useEffect(() => {
    if (!isRouteTransition) return
    // Hash-only jumps keep current scroll position (handled by HashLink).
    if (typeof window === "undefined") return
    if (window.location.hash) return
    window.scrollTo({ top: 0, behavior: "smooth" })
  }, [pathname, isRouteTransition])

  return (
    <div
      key={pathname}
      className={cn(isRouteTransition && "marketing-page-enter", className)}
    >
      {children}
    </div>
  )
}
