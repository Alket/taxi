"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import { ThemeProvider as NextThemesProvider } from "next-themes"

/**
 * Theme is user-controllable on /admin and /driver.
 * Public pages (homepage, /book, etc.) are always forced to light.
 * Marks <html> with `.admin` so console tokens apply to portaled UI.
 */
export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isConsole =
    pathname.startsWith("/admin") || pathname.startsWith("/driver")

  React.useEffect(() => {
    document.documentElement.classList.toggle("admin", isConsole)
    return () => {
      document.documentElement.classList.remove("admin")
    }
  }, [isConsole])

  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      storageKey="admin-theme"
      forcedTheme={isConsole ? undefined : "light"}
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  )
}
