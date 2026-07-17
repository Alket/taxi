"use client"

import * as React from "react"
import { useTheme } from "next-themes"
import { MoonIcon, SunIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

export function AdminThemeToggle({
  className,
  variant = "outline",
  showLabel = false,
}: {
  className?: string
  variant?: "outline" | "ghost" | "secondary"
  showLabel?: boolean
}) {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  const isDark = mounted && resolvedTheme === "dark"

  return (
    <Button
      type="button"
      variant={variant}
      size={showLabel ? "sm" : "icon"}
      className={cn(
        showLabel
          ? "h-10 w-full touch-manipulation justify-start gap-2 sm:h-8"
          : "size-10 touch-manipulation sm:size-8",
        className,
      )}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      disabled={!mounted}
    >
      {isDark ? <SunIcon /> : <MoonIcon />}
      {showLabel ? (
        <span>{isDark ? "Light mode" : "Dark mode"}</span>
      ) : null}
    </Button>
  )
}
