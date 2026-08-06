"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { type LucideIcon, XIcon } from "lucide-react"

import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

type FilterOption = {
  value: string
  label: string
  description?: string | null
}

type PanelPos = {
  top: number
  left: number
  width: number
  strategy: "fixed" | "absolute"
}

function DesktopPanel({
  open,
  onClose,
  anchorRef,
  children,
  className,
}: {
  open: boolean
  onClose: () => void
  anchorRef: React.RefObject<HTMLElement | null>
  children: React.ReactNode
  className?: string
}) {
  const [mounted, setMounted] = React.useState(false)
  const [ready, setReady] = React.useState(false)
  const [pos, setPos] = React.useState<PanelPos>({
    top: 0,
    left: 0,
    width: 280,
    strategy: "fixed",
  })
  const [container, setContainer] = React.useState<HTMLElement | null>(null)
  const panelRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  React.useLayoutEffect(() => {
    if (!open || !anchorRef.current) {
      setReady(false)
      setContainer(null)
      return
    }

    function place() {
      const el = anchorRef.current
      if (!el) return

      const sheet = el.closest(
        '[data-slot="sheet-content"]',
      ) as HTMLElement | null
      const r = el.getBoundingClientRect()
      const width = Math.min(360, Math.max(r.width, 240))
      const panelHeight = panelRef.current?.offsetHeight ?? 280

      if (sheet) {
        // Keep the menu inside the booking sheet (modal focus scope + no clip).
        const sr = sheet.getBoundingClientRect()
        const spaceBelow = sr.bottom - r.bottom - 12
        const spaceAbove = r.top - sr.top - 12
        const openUp =
          spaceBelow < Math.min(panelHeight, 280) && spaceAbove > spaceBelow

        let top = openUp
          ? r.top - sr.top - panelHeight - 6
          : r.bottom - sr.top + 6
        let left = r.left - sr.left
        left = Math.min(left, sr.width - width - 8)
        left = Math.max(8, left)
        top = Math.max(8, Math.min(top, sr.height - panelHeight - 8))

        setContainer(sheet)
        setPos({ top, left, width, strategy: "absolute" })
      } else {
        let left = r.left
        left = Math.min(left, window.innerWidth - width - 12)
        left = Math.max(12, left)

        const spaceBelow = window.innerHeight - r.bottom - 12
        const spaceAbove = r.top - 12
        const openUp =
          spaceBelow < Math.min(panelHeight, 280) && spaceAbove > spaceBelow

        let top = openUp ? r.top - panelHeight - 6 : r.bottom + 6
        top = Math.min(top, window.innerHeight - panelHeight - 12)
        top = Math.max(12, top)

        setContainer(document.body)
        setPos({ top, left, width, strategy: "fixed" })
      }
      setReady(true)
    }

    place()
    const raf = window.requestAnimationFrame(place)
    window.addEventListener("resize", place)
    window.addEventListener("scroll", place, true)
    return () => {
      window.cancelAnimationFrame(raf)
      window.removeEventListener("resize", place)
      window.removeEventListener("scroll", place, true)
    }
  }, [open, anchorRef])

  if (!open || !mounted || !container) return null

  return createPortal(
    <>
      <button
        type="button"
        className={cn(
          "cursor-default",
          pos.strategy === "fixed"
            ? "fixed inset-0 z-[280]"
            : "absolute inset-0 z-[60]",
        )}
        aria-label="Close options"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        style={{
          top: pos.top,
          left: pos.left,
          width: pos.width,
          position: pos.strategy,
          visibility: ready ? "visible" : "hidden",
        }}
        className={cn(
          "rounded-xl border bg-popover p-2 text-popover-foreground shadow-lg ring-1 ring-foreground/10",
          pos.strategy === "fixed" ? "z-[290]" : "z-[70]",
          className,
        )}
        role="listbox"
      >
        {children}
      </div>
    </>,
    container,
  )
}

/**
 * Filter dropdown styled like AdminDriverField (outline trigger + clear + sheet/panel).
 */
export function AdminFilterSelectField({
  label,
  value,
  onChange,
  options,
  icon: Icon,
  allValue = "all",
  placeholder,
  className,
  allowClear = true,
  disabled = false,
  emptyMessage = "No options available.",
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: FilterOption[]
  icon: LucideIcon
  /** Value treated as “cleared / default” (muted label, clear resets here). */
  allValue?: string
  /** Shown when value is empty or not found in options. */
  placeholder?: string
  className?: string
  allowClear?: boolean
  disabled?: boolean
  emptyMessage?: string
}) {
  const isMobile = useIsMobile()
  const [open, setOpen] = React.useState(false)
  const triggerRef = React.useRef<HTMLDivElement>(null)

  const selected = options.find((option) => option.value === value)
  const isCleared = value === allValue || !value
  const display =
    selected?.label ??
    placeholder ??
    options[0]?.label ??
    label
  const showClear = allowClear && !isCleared && Boolean(value)

  const list = (
    <div className="flex max-h-64 flex-col gap-0.5 overflow-y-auto overscroll-contain">
      {options.length === 0 ? (
        <p className="px-3 py-6 text-center text-sm text-muted-foreground">
          {emptyMessage}
        </p>
      ) : (
        options.map((option) => (
          <Button
            key={option.value}
            type="button"
            variant={value === option.value ? "secondary" : "ghost"}
            className={cn(
              "h-auto min-h-10 w-full touch-manipulation justify-start px-3 py-2 text-left font-normal md:min-h-9 md:text-sm",
              value === option.value && "font-medium",
            )}
            onClick={() => {
              onChange(option.value)
              setOpen(false)
            }}
          >
            <span className="flex min-w-0 flex-col items-start gap-0.5">
              <span className="truncate">{option.label}</span>
              {option.description ? (
                <span className="truncate text-xs text-muted-foreground">
                  {option.description}
                </span>
              ) : null}
            </span>
          </Button>
        ))
      )}
    </div>
  )

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label ? (
        <span className="text-xs text-muted-foreground">{label}</span>
      ) : null}
      <div ref={triggerRef} className="flex gap-1.5">
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "h-11 min-w-0 flex-1 touch-manipulation justify-start gap-2 px-3 text-left font-normal md:h-10",
            (isCleared || !selected) && "text-muted-foreground",
          )}
          onClick={() => setOpen((current) => !current)}
        >
          <Icon className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate text-base md:text-sm">{display}</span>
        </Button>
        {showClear ? (
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-11 shrink-0 touch-manipulation md:size-10"
            aria-label={`Clear ${label}`}
            disabled={disabled}
            onClick={() => onChange(allValue)}
          >
            <XIcon className="size-4" />
          </Button>
        ) : null}
      </div>

      {isMobile ? (
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent
            side="bottom"
            className="max-h-[min(92dvh,40rem)] gap-0 rounded-t-2xl p-0"
          >
            <SheetHeader className="border-b p-4 pr-12 text-left">
              <SheetTitle className="text-base">{label || "Select"}</SheetTitle>
            </SheetHeader>
            <div className="overflow-y-auto overscroll-contain p-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
              {list}
            </div>
          </SheetContent>
        </Sheet>
      ) : (
        <DesktopPanel
          open={open}
          onClose={() => setOpen(false)}
          anchorRef={triggerRef}
        >
          {list}
        </DesktopPanel>
      )}
    </div>
  )
}
