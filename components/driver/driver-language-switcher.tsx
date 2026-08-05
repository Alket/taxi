"use client"

import { cn } from "@/lib/utils"
import {
  DRIVER_LOCALES,
  DRIVER_LOCALE_LABELS,
  setDriverLocale,
  useDriverLocale,
  useDriverT,
  type DriverLocale,
} from "@/lib/i18n/driver"

export function DriverLanguageSwitcher({
  className,
  size = "default",
}: {
  className?: string
  size?: "default" | "sm"
}) {
  const locale = useDriverLocale()
  const t = useDriverT()

  function select(next: DriverLocale) {
    if (next === locale) return
    setDriverLocale(next)
  }

  return (
    <div
      role="group"
      aria-label={t("lang.label")}
      className={cn(
        "inline-flex rounded-lg border border-border bg-background p-0.5",
        className,
      )}
    >
      {DRIVER_LOCALES.map((code) => {
        const active = code === locale
        return (
          <button
            key={code}
            type="button"
            onClick={() => select(code)}
            className={cn(
              "rounded-md font-medium transition-colors touch-manipulation",
              size === "sm"
                ? "h-8 min-w-9 px-2 text-xs"
                : "h-9 min-w-10 px-2.5 text-sm",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
            aria-pressed={active}
          >
            {DRIVER_LOCALE_LABELS[code].short}
          </button>
        )
      })}
    </div>
  )
}
