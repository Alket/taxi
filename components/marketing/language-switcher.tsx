"use client"

import * as React from "react"
import { CheckIcon, ChevronDownIcon } from "lucide-react"

import { cn } from "@/lib/utils"

const LANGUAGES = [
  { code: "en", label: "English", short: "EN" },
  { code: "it", label: "Italian", short: "IT" },
  { code: "de", label: "German", short: "DE" },
  { code: "pl", label: "Polish", short: "PL" },
  { code: "tr", label: "Turkish", short: "TR" },
  { code: "uk", label: "Ukrainian", short: "UK" },
  { code: "ru", label: "Russian", short: "RU" },
] as const

type LangCode = (typeof LANGUAGES)[number]["code"]

type LanguageSwitcherProps = {
  className?: string
  /** Compact pill for header; chips for mobile menus. */
  variant?: "pill" | "chips"
}

export function LanguageSwitcher({
  className,
  variant = "pill",
}: LanguageSwitcherProps) {
  const rootRef = React.useRef<HTMLDivElement>(null)
  const [open, setOpen] = React.useState(false)
  const [active, setActive] = React.useState<LangCode>("en")
  const current = LANGUAGES.find((lang) => lang.code === active) ?? LANGUAGES[0]

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
        {LANGUAGES.map((lang) => (
          <button
            key={lang.code}
            type="button"
            onClick={() => setActive(lang.code)}
            className={cn(
              "rounded-full px-2.5 py-1 text-xs font-bold tracking-wide transition-colors",
              active === lang.code
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            {lang.short}
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
        aria-label={`Language: ${current.label}`}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-brand-surface px-2.5 text-xs font-extrabold tracking-wide text-brand transition-colors",
          "hover:border-primary/40 hover:bg-muted",
          open && "border-primary/50 bg-muted",
        )}
      >
        <span className="text-sm font-bold text-brand">
          {current.short}
        </span>
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
          aria-label="Select language"
          className="absolute top-[calc(100%+0.5rem)] left-1/2 z-50 w-56 -translate-x-1/2 overflow-hidden rounded-2xl border border-border bg-brand-surface p-1.5 shadow-[0_18px_40px_rgba(45,59,78,0.14)]"
        >
          <p className="px-2.5 pb-1.5 pt-1 text-[10px] font-bold tracking-[0.14em] text-muted-foreground uppercase">
            Language
          </p>
          <div className="grid gap-0.5">
            {LANGUAGES.map((lang) => {
              const selected = active === lang.code
              return (
                <button
                  key={lang.code}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    setActive(lang.code)
                    setOpen(false)
                  }}
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
                    {lang.short}
                  </span>
                  <span className="min-w-0 flex-1 text-sm font-semibold">
                    {lang.label}
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
