"use client"

import { useEffect, type ReactNode } from "react"
import { usePathname } from "next/navigation"

import { cn } from "@/lib/utils"

/**
 * Soft fade/slide-in when navigating between marketing routes.
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

  useEffect(() => {
    // Hash-only jumps keep current scroll position (handled by HashLink).
    if (typeof window === "undefined") return
    if (window.location.hash) return
    window.scrollTo({ top: 0, behavior: "smooth" })
  }, [pathname])

  return (
    <div key={pathname} className={cn("marketing-page-enter", className)}>
      {children}
    </div>
  )
}
