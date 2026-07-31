"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"
import { CheckIcon, ChevronDownIcon } from "lucide-react"

import {
  LOCALES,
  LOCALE_LABELS,
  type Locale,
  localeFromPathname,
  localePath,
  stripLocalePrefix,
} from "@/lib/i18n/locales"
import { setClientLocale } from "@/lib/i18n/use-locale"
import { t } from "@/lib/i18n/t"
import { cn } from "@/lib/utils"

type LanguageSwitcherProps = {
  className?: string
  /** Compact pill for header; chips for mobile menus. */
  variant?: "pill" | "chips"
}

export function LanguageSwitcher({
  className,
  variant = "pill",
}: LanguageSwitcherProps) {
  const router = useRouter()
  const pathname = usePathname() || "/"
  const rootRef = React.useRef<HTMLDivElement>(null)
  const [open, setOpen] = React.useState(false)

  const active = localeFromPathname(pathname)
  const current = {
    code: active,
    label: LOCALE_LABELS[active].label,
    short: LOCALE_LABELS[active].short,
  }

  function navigateToLocale(next: Locale) {
    const base = stripLocalePrefix(pathname)
    const query =
      typeof window !== "undefined"
        ? window.location.search.replace(/^\?/, "")
        : ""
    const withQuery = query ? `${base}?${query}` : base
    setClientLocale(next)
    router.push(localePath(withQuery, next))
    router.refresh()
    setOpen(false)
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
          <button
            key={code}
            type="button"
            onClick={() => navigateToLocale(code)}
            className={cn(
              "rounded-full px-2.5 py-1 text-xs font-bold tracking-wide transition-colors",
              active === code
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            {LOCALE_LABELS[code].short}
          </button>
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
                <button
                  key={code}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => navigateToLocale(code)}
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
                </button>
              )
            })}
          </div>
        </div>
      ) : null}
    </div>
  )
}
