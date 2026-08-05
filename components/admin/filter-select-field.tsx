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
}

type PanelPos = {
  top: number
  left: number
  width: number
}

function DesktopPanel({
  open,
  onClose,
  anchorRef,
  children,
}: {
  open: boolean
  onClose: () => void
  anchorRef: React.RefObject<HTMLElement | null>
  children: React.ReactNode
}) {
  const [mounted, setMounted] = React.useState(false)
  const [ready, setReady] = React.useState(false)
  const [pos, setPos] = React.useState<PanelPos>({
    top: 0,
    left: 0,
    width: 280,
  })
  const panelRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  React.useLayoutEffect(() => {
    if (!open || !anchorRef.current) {
      setReady(false)
      return
    }

    function place() {
      const el = anchorRef.current
      if (!el) return
      const r = el.getBoundingClientRect()
      const width = Math.min(360, Math.max(r.width, 240))
      const panelHeight = panelRef.current?.offsetHeight ?? 280
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
      setPos({ top, left, width })
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

  React.useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    function onPointer(e: MouseEvent) {
      const t = e.target as Node
      if (anchorRef.current?.contains(t)) return
      if (panelRef.current?.contains(t)) return
      onClose()
    }
    window.addEventListener("keydown", onKey)
    window.addEventListener("mousedown", onPointer)
    return () => {
      window.removeEventListener("keydown", onKey)
      window.removeEventListener("mousedown", onPointer)
    }
  }, [open, onClose, anchorRef])

  if (!open || !mounted) return null

  return createPortal(
    <div
      ref={panelRef}
      className={cn(
        "z-[80] overflow-hidden rounded-xl border bg-popover p-1.5 text-popover-foreground shadow-lg",
        !ready && "invisible",
      )}
      style={{
        position: "fixed",
        top: pos.top,
        left: pos.left,
        width: pos.width,
      }}
      role="listbox"
    >
      {children}
    </div>,
    document.body,
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
  className,
  allowClear = true,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: FilterOption[]
  icon: LucideIcon
  allValue?: string
  className?: string
  allowClear?: boolean
}) {
  const isMobile = useIsMobile()
  const [open, setOpen] = React.useState(false)
  const triggerRef = React.useRef<HTMLDivElement>(null)

  const display =
    options.find((option) => option.value === value)?.label ??
    options[0]?.label ??
    label
  const isAll = value === allValue
  const showClear = allowClear && !isAll

  const list = (
    <div className="flex max-h-64 flex-col gap-0.5 overflow-y-auto overscroll-contain">
      {options.map((option) => (
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
          <span className="truncate">{option.label}</span>
        </Button>
      ))}
    </div>
  )

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <span className="text-xs text-muted-foreground">{label}</span>
      <div ref={triggerRef} className="flex gap-1.5">
        <Button
          type="button"
          variant="outline"
          className={cn(
            "h-11 min-w-0 flex-1 touch-manipulation justify-start gap-2 px-3 text-left font-normal md:h-10",
            isAll && "text-muted-foreground",
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
              <SheetTitle className="text-base">{label}</SheetTitle>
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
