"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import { ThemeProvider as NextThemesProvider } from "next-themes"

/**
 * next-themes injects an inline <script> to prevent theme flicker.
 * React 19 / Next 16 logs a console error for script tags inside client
 * components even though the SSR script runs correctly. Filter that noise.
 * @see https://github.com/shadcn-ui/ui/issues/10104
 */
if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
  const originalConsoleError = console.error
  console.error = (...args: unknown[]) => {
    const text = args
      .map((arg) => (typeof arg === "string" ? arg : ""))
      .join(" ")
    if (text.includes("Encountered a script tag while rendering React component")) {
      return
    }
    originalConsoleError.apply(console, args)
  }
}

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
