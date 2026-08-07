"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import { CheckIcon, ChevronDownIcon } from "lucide-react"

import {
  LOCALES,
  LOCALE_LABELS,
  type Locale,
  localePath,
  stripLocalePrefix,
} from "@/lib/i18n/locales"
import { setClientLocale, useLocale } from "@/lib/i18n/use-locale"
import { t } from "@/lib/i18n/t"
import { cn } from "@/lib/utils"

type LanguageSwitcherProps = {
  className?: string
  /** Compact pill for header; chips for mobile menus. */
  variant?: "pill" | "chips"
  /** Called after a locale is picked (e.g. to close a parent mobile menu). */
  onNavigate?: () => void
}

export function LanguageSwitcher({
  className,
  variant = "pill",
  onNavigate,
}: LanguageSwitcherProps) {
  const pathname = usePathname() || "/"
  const rootRef = React.useRef<HTMLDivElement>(null)
  const [open, setOpen] = React.useState(false)

  // Path + cookie — matches useLocale after middleware rewrite strips the prefix.
  const active = useLocale()
  const current = {
    code: active,
    label: LOCALE_LABELS[active].label,
    short: LOCALE_LABELS[active].short,
  }

  const basePath = stripLocalePrefix(pathname)

  /** Localized path + current query/hash (read from window so soft-nav state stays intact). */
  function hrefForLocale(code: Locale) {
    const path = localePath(basePath, code)
    if (typeof window === "undefined") return path
    return `${path}${window.location.search}${window.location.hash}`
  }

  /**
   * Hard-reload into the new locale. Soft client navigation leaves server-rendered
   * CMS/booking copy and some client widgets on the previous language until refresh.
   */
  function onSelectLocale(next: Locale, event?: React.MouseEvent) {
    event?.preventDefault()
    if (next === active) {
      setOpen(false)
      onNavigate?.()
      return
    }
    setClientLocale(next)
    setOpen(false)
    onNavigate?.()
    window.location.assign(hrefForLocale(next))
  }

  React.useEffect(() => {
    if (!open) return

    function onPointerDown(event: MouseEvent | TouchEvent) {
      const target = event.target as Node | null
      if (rootRef.current && target && !rootRef.current.contains(target)) {
        setOpen(false)
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false)
    }

    document.addEventListener("mousedown", onPointerDown)
    document.addEventListener("touchstart", onPointerDown)
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("mousedown", onPointerDown)
      document.removeEventListener("touchstart", onPointerDown)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [open])

  if (variant === "chips") {
    return (
      <div className={cn("flex flex-wrap gap-1.5", className)}>
        {LOCALES.map((code) => (
          <a
            key={code}
            href={hrefForLocale(code)}
            onClick={(event) => onSelectLocale(code, event)}
            className={cn(
              "rounded-full px-2.5 py-1 text-xs font-bold tracking-wide transition-colors",
              active === code
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            {LOCALE_LABELS[code].short}
          </a>
        ))}
      </div>
    )
  }

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${t(active, "lang.label")}: ${current.label}`}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-brand-surface px-2.5 text-xs font-extrabold tracking-wide text-brand transition-colors",
          "hover:border-primary/40 hover:bg-muted",
          open && "border-primary/50 bg-muted",
        )}
      >
        <span className="text-sm font-bold text-brand">{current.short}</span>
        <ChevronDownIcon
          className={cn(
            "size-3.5 text-muted-foreground transition-transform duration-200",
            open && "rotate-180",
          )}
          strokeWidth={2.2}
        />
      </button>

      {open ? (
        <div
          role="listbox"
          aria-label={t(active, "lang.label")}
          className="absolute top-[calc(100%+0.5rem)] left-1/2 z-50 w-56 -translate-x-1/2 overflow-hidden rounded-2xl border border-border bg-brand-surface p-1.5 shadow-[0_18px_40px_rgba(45,59,78,0.14)]"
        >
          <p className="px-2.5 pb-1.5 pt-1 text-[10px] font-bold tracking-[0.14em] text-muted-foreground uppercase">
            {t(active, "lang.label")}
          </p>
          <div className="grid gap-0.5">
            {LOCALES.map((code) => {
              const selected = active === code
              return (
                <a
                  key={code}
                  href={hrefForLocale(code)}
                  role="option"
                  aria-selected={selected}
                  onClick={(event) => onSelectLocale(code, event)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors",
                    selected
                      ? "bg-primary/10 text-brand"
                      : "text-muted-foreground hover:bg-muted hover:text-brand",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-black tracking-wide",
                      selected
                        ? "bg-primary text-primary-foreground"
                        : "bg-brand-page text-brand",
                    )}
                  >
                    {LOCALE_LABELS[code].short}
                  </span>
                  <span className="min-w-0 flex-1 text-sm font-semibold">
                    {LOCALE_LABELS[code].label}
                  </span>
                  {selected ? (
                    <CheckIcon className="size-4 shrink-0 text-primary" />
                  ) : null}
                </a>
              )
            })}
          </div>
        </div>
      ) : null}
    </div>
  )
}
