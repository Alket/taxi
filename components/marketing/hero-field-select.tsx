"use client"

import * as React from "react"
import { MapPinIcon, SearchIcon } from "lucide-react"

import { useIsMobile } from "@/hooks/use-mobile"
import { useBodyScrollLock } from "@/hooks/use-body-scroll-lock"
import { useT } from "@/lib/i18n/use-locale"
import { cn } from "@/lib/utils"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox"
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

export type HeroFieldOption = { value: string; label: string }

function isAppleTouchDevice() {
  if (typeof navigator === "undefined") return false
  if (/iP(hone|od|ad)/.test(navigator.userAgent)) return true
  // iPadOS 13+ reports as MacIntel with touch.
  return (
    navigator.platform === "MacIntel" &&
    typeof navigator.maxTouchPoints === "number" &&
    navigator.maxTouchPoints > 1
  )
}

/** Searchable place select matching the homepage booking form. */
export function HeroFieldSelect({
  value,
  placeholder,
  options,
  onChange,
  anchor,
  mobileSheet = false,
  sheetTitle,
  onAfterSelect,
  open: openProp,
  onOpenChange,
}: {
  value: string | null
  placeholder: string
  options: HeroFieldOption[]
  onChange: (value: string) => void
  /** Full-width row/card element — popup matches its width and sits under it. */
  anchor: React.RefObject<HTMLElement | null>
  /** Mobile-only: open destinations in a full-screen sheet. */
  mobileSheet?: boolean
  sheetTitle?: string
  onAfterSelect?: () => void
  /** Optional controlled open state (sheet or desktop combobox). */
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const tr = useT()
  const isMobile = useIsMobile()
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false)
  const isControlled = openProp !== undefined
  const sheetOpen = isControlled ? openProp : uncontrolledOpen
  const setSheetOpen = React.useCallback(
    (next: boolean) => {
      if (!isControlled) setUncontrolledOpen(next)
      onOpenChange?.(next)
    },
    [isControlled, onOpenChange],
  )
  const [query, setQuery] = React.useState("")
  const [listKey, setListKey] = React.useState(0)
  const searchInputRef = React.useRef<HTMLInputElement>(null)
  const listRef = React.useRef<HTMLDivElement>(null)
  const isIOS = React.useMemo(() => isAppleTouchDevice(), [])
  // Skip our lock on iOS. Also use modal="trap-focus" below so Base UI does
  // not apply overflow:hidden — that lock is what kills nested scroll in Safari
  // until the search field is tapped.
  useBodyScrollLock(Boolean(mobileSheet && isMobile && sheetOpen && !isIOS))

  const selected =
    value != null
      ? (options.find((opt) => opt.value === value) ?? null)
      : null

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter((opt) => opt.label.toLowerCase().includes(q))
  }, [options, query])

  React.useEffect(() => {
    if (!sheetOpen) {
      setQuery("")
      return
    }
    // Remount the scroll region each open — iOS Safari often keeps a dead
    // scroll layer after close/reopen of a full-screen sheet.
    setListKey((n) => n + 1)

    if (isIOS) {
      // Wake the scroll layer without focusing the keyboard.
      const timer = window.setTimeout(() => {
        const el = listRef.current
        if (!el) return
        el.scrollTop = 1
        el.scrollTop = 0
      }, 80)
      return () => window.clearTimeout(timer)
    }

    const timer = window.setTimeout(() => {
      searchInputRef.current?.focus()
    }, 280)
    return () => window.clearTimeout(timer)
  }, [sheetOpen, isIOS])

  function pick(next: string) {
    onChange(next)
    if (onAfterSelect) {
      // Parent runs a covered sheet transition. Controlled sheets are closed by
      // the parent once the cover paints; uncontrolled sheets close on the next
      // frames so the hero never flashes between modals.
      onAfterSelect()
      if (!isControlled) {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => setSheetOpen(false))
        })
      }
      return
    }
    setSheetOpen(false)
  }

  if (mobileSheet && isMobile) {
    return (
      <>
        <button
          type="button"
          className="flex w-full min-w-0 items-center justify-between gap-2 text-left touch-manipulation"
          onClick={() => setSheetOpen(true)}
        >
          <span
            className={cn(
              "min-w-0 flex-1 truncate text-base font-bold",
              selected
                ? "text-[color:var(--brand-ink)]"
                : "font-semibold text-muted-foreground",
            )}
          >
            {selected?.label ?? placeholder}
          </span>
          <SearchIcon className="size-4 shrink-0 text-muted-foreground" />
        </button>

        <Sheet
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          // trap-focus: keep focus inside, but skip Base UI document scroll lock
          // (overflow:hidden on html/body breaks iOS nested overflow scrolling).
          modal={isIOS ? "trap-focus" : true}
        >
          <SheetContent
            side="bottom"
            showCloseButton
            className="flex h-[100dvh] max-h-[100dvh] flex-col gap-0 overflow-hidden rounded-none border-0 bg-brand-surface p-0 text-[color:var(--brand-ink)] data-[side=bottom]:h-[100dvh]"
          >
            <SheetHeader className="shrink-0 border-b border-border px-4 py-3 pr-14">
              <SheetTitle className="text-base font-bold text-brand">
                {sheetTitle ?? tr("book.chooseDestination")}
              </SheetTitle>
            </SheetHeader>

            <div className="shrink-0 border-b border-border px-4 py-3">
              <div className="relative">
                <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  ref={searchInputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={tr("book.typeToSearch")}
                  enterKeyHint="search"
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                  className="h-11 rounded-xl border-border bg-muted/40 pl-9 text-base font-semibold"
                />
              </div>
            </div>

            {/* Absolute fill gives iOS a hard height; flex-1 alone often leaves a dead scroll layer. */}
            <div className="relative min-h-0 flex-1">
              <div
                key={listKey}
                ref={listRef}
                className="absolute inset-0 overflow-y-auto overscroll-y-contain px-2 py-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] [-webkit-overflow-scrolling:touch]"
                style={{ touchAction: "pan-y", WebkitOverflowScrolling: "touch" }}
              >
                {filtered.length === 0 ? (
                  <div className="flex flex-col items-center gap-1.5 px-4 py-10 text-sm text-muted-foreground">
                    <SearchIcon className="size-5 opacity-50" />
                    {tr("book.noMatchingPlaces")}
                  </div>
                ) : (
                  <ul className="flex flex-col gap-0.5">
                    {filtered.map((item) => {
                      const isSelected = item.value === value
                      return (
                        <li key={item.value}>
                          <button
                            type="button"
                            onClick={() => pick(item.value)}
                            // pan-y (not touch-manipulation) so vertical drags
                            // scroll the list when the gesture starts on a row.
                            className={cn(
                              "flex w-full items-center gap-3 rounded-xl px-3 py-3.5 text-left transition-colors",
                              isSelected
                                ? "bg-[color-mix(in_srgb,var(--brand-accent)_14%,white)]"
                                : "hover:bg-muted active:bg-muted",
                            )}
                            style={{ touchAction: "pan-y" }}
                          >
                            <span className="pointer-events-none flex size-10 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--brand-accent)_12%,white)] text-brand-accent">
                              <MapPinIcon className="size-4" />
                            </span>
                            <span className="pointer-events-none min-w-0 flex-1 text-base font-semibold whitespace-normal text-[color:var(--brand-ink)]">
                              {item.label}
                            </span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </>
    )
  }

  return (
    <Combobox
      items={options}
      value={selected}
      open={sheetOpen}
      onOpenChange={(next) => setSheetOpen(next)}
      onValueChange={(item: HeroFieldOption | null) => {
        if (item) {
          onChange(item.value)
          onAfterSelect?.()
        }
      }}
      itemToStringLabel={(item: HeroFieldOption) => item.label}
      isItemEqualToValue={(a: HeroFieldOption, b: HeroFieldOption) =>
        a.value === b.value
      }
      autoHighlight
    >
      <ComboboxInput
        placeholder={placeholder}
        showTrigger
        className={cn(
          "h-auto w-full min-w-0 border-0 bg-transparent shadow-none",
          "has-[[data-slot=input-group-control]:focus-visible]:border-transparent",
          "has-[[data-slot=input-group-control]:focus-visible]:ring-0",
          "[&_[data-slot=input-group-control]]:h-auto",
          "[&_[data-slot=input-group-control]]:border-0",
          "[&_[data-slot=input-group-control]]:bg-transparent",
          "[&_[data-slot=input-group-control]]:px-0",
          "[&_[data-slot=input-group-control]]:py-0",
          "[&_[data-slot=input-group-control]]:text-base md:[&_[data-slot=input-group-control]]:text-sm",
          "[&_[data-slot=input-group-control]]:font-bold",
          "[&_[data-slot=input-group-control]]:text-[color:var(--brand-ink)]",
          "[&_[data-slot=input-group-control]]:shadow-none",
          "[&_[data-slot=input-group-control]]:placeholder:font-semibold",
          "[&_[data-slot=input-group-control]]:placeholder:text-muted-foreground",
          "[&_[data-slot=input-group-control]]:focus-visible:ring-0",
          "[&_[data-slot=input-group-addon]]:pr-0",
          "[&_[data-slot=combobox-trigger]_svg]:text-muted-foreground",
        )}
      />
      <ComboboxContent
        side="bottom"
        align="start"
        sideOffset={6}
        anchor={anchor}
        className="w-(--anchor-width) min-w-(--anchor-width) max-w-none rounded-xl bg-white p-0 text-[color:var(--brand-ink)] shadow-[0_16px_40px_rgba(15,23,42,0.16)] ring-1 ring-black/8 *:data-[slot=input-group]:hidden"
      >
        <div className="border-b border-border/70 px-3 py-2.5">
          <p className="flex items-center gap-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
            <SearchIcon className="size-3.5" />
            {tr("book.typeToSearch")}
          </p>
        </div>
        <ComboboxEmpty className="flex-col items-center gap-1.5 px-4 py-6">
          <SearchIcon className="size-5 opacity-50" />
          {tr("book.noMatchingPlaces")}
        </ComboboxEmpty>
        <ComboboxList className="max-h-64 p-1.5">
          {(item: HeroFieldOption) => (
            <ComboboxItem
              key={item.value}
              value={item}
              className="gap-2.5 rounded-lg px-2.5 py-2.5 text-sm font-semibold text-[color:var(--brand-ink)] data-highlighted:bg-[color-mix(in_srgb,var(--brand-accent)_14%,white)] data-highlighted:text-[color:var(--brand-ink)] not-data-[variant=destructive]:data-highlighted:**:text-[color:var(--brand-ink)]"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--brand-accent)_12%,white)] text-brand-accent">
                <MapPinIcon className="size-3.5" />
              </span>
              <span className="min-w-0 flex-1 whitespace-normal">
                {item.label}
              </span>
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
