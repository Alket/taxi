"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import {
  CalendarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  XIcon,
} from "lucide-react"

import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"] as const
const HOURS = Array.from({ length: 24 }, (_, i) => i)
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]

function pad2(n: number) {
  return String(n).padStart(2, "0")
}

/** Local calendar date → YYYY-MM-DD (no timezone shift). */
export function toDateInputValue(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

/** Local date+time → YYYY-MM-DDTHH:mm (datetime-local shape). */
export function toDateTimeInputValue(d: Date) {
  return `${toDateInputValue(d)}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

export function parseDateInputValue(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const [y, m, day] = value.split("-").map(Number)
  const d = new Date(y!, m! - 1, day!, 12, 0, 0, 0)
  if (
    d.getFullYear() !== y ||
    d.getMonth() !== m! - 1 ||
    d.getDate() !== day
  ) {
    return null
  }
  return d
}

export function parseDateTimeInputValue(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) return null
  const [datePart, timePart] = value.split("T")
  const [y, m, day] = datePart!.split("-").map(Number)
  const [hh, mm] = timePart!.split(":").map(Number)
  const d = new Date(y!, m! - 1, day!, hh!, mm!, 0, 0)
  if (Number.isNaN(d.getTime())) return null
  return d
}

function startOfDay(d: Date) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function formatDateDisplay(value: string) {
  const d = parseDateInputValue(value)
  if (!d) return null
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

function formatDateTimeDisplay(value: string) {
  const d = parseDateTimeInputValue(value)
  if (!d) return null
  return d.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function MonthGrid({
  view,
  selected,
  minDate,
  maxDate,
  onSelectDay,
  onViewChange,
  compact = false,
}: {
  view: Date
  selected: Date | null
  minDate: Date | null
  maxDate: Date | null
  onSelectDay: (day: Date) => void
  onViewChange: (view: Date) => void
  compact?: boolean
}) {
  const year = view.getFullYear()
  const month = view.getMonth()
  const firstDow = new Date(year, month, 1).getDay()
  const totalDays = new Date(year, month + 1, 0).getDate()
  const cells: (number | null)[] = [
    ...Array.from({ length: firstDow }, () => null),
    ...Array.from({ length: totalDays }, (_, i) => i + 1),
  ]
  const monthLabel = view.toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  })

  function isDisabled(day: number) {
    const date = startOfDay(new Date(year, month, day))
    if (minDate && date < startOfDay(minDate)) return true
    if (maxDate && date > startOfDay(maxDate)) return true
    return false
  }

  return (
    <div className={cn("flex flex-col", compact ? "gap-2" : "gap-3")}>
      <div className="flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className={cn(
            "touch-manipulation",
            compact ? "size-7" : "size-10",
          )}
          aria-label="Previous month"
          onClick={() => onViewChange(new Date(year, month - 1, 1))}
        >
          <ChevronLeftIcon className={compact ? "size-3.5" : "size-4"} />
        </Button>
        <p
          className={cn(
            "font-semibold tabular-nums",
            compact ? "text-xs" : "text-sm",
          )}
        >
          {monthLabel}
        </p>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className={cn(
            "touch-manipulation",
            compact ? "size-7" : "size-10",
          )}
          aria-label="Next month"
          onClick={() => onViewChange(new Date(year, month + 1, 1))}
        >
          <ChevronRightIcon className={compact ? "size-3.5" : "size-4"} />
        </Button>
      </div>

      <div
        className={cn(
          "grid grid-cols-7 text-center font-medium tracking-wide text-muted-foreground uppercase",
          compact ? "gap-0.5 text-[10px]" : "gap-1 text-[11px]",
        )}
      >
        {WEEKDAYS.map((d) => (
          <div key={d} className={compact ? "py-0.5" : "py-1"}>
            {d}
          </div>
        ))}
      </div>

      <div className={cn("grid grid-cols-7", compact ? "gap-0.5" : "gap-1")}>
        {cells.map((day, idx) => {
          if (day == null) {
            return (
              <div
                key={`e-${idx}`}
                className={compact ? "h-7" : "aspect-square"}
              />
            )
          }
          const date = new Date(year, month, day)
          const disabled = isDisabled(day)
          const isSelected = selected ? sameDay(date, selected) : false
          const isToday = sameDay(date, new Date())
          return (
            <button
              key={day}
              type="button"
              disabled={disabled}
              onClick={() => onSelectDay(startOfDay(date))}
              className={cn(
                "flex items-center justify-center rounded-full font-medium touch-manipulation transition-colors",
                compact
                  ? "h-7 text-xs"
                  : "aspect-square text-base",
                disabled && "cursor-not-allowed text-muted-foreground/35",
                !disabled && !isSelected && "hover:bg-muted active:bg-muted",
                isSelected &&
                  "bg-primary text-primary-foreground hover:bg-primary",
                !isSelected && isToday && "ring-1 ring-ring/50",
              )}
            >
              {day}
            </button>
          )
        })}
      </div>
    </div>
  )
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
  const [pos, setPos] = React.useState({ top: 0, left: 0, width: 280 })

  React.useEffect(() => {
    setMounted(true)
  }, [])

  React.useLayoutEffect(() => {
    if (!open || !anchorRef.current) return

    function place() {
      const el = anchorRef.current
      if (!el) return
      const r = el.getBoundingClientRect()
      const width = Math.min(280, Math.max(240, r.width))
      let left = r.left
      // Keep panel inside the viewport
      left = Math.min(left, window.innerWidth - width - 12)
      left = Math.max(12, left)
      let top = r.bottom + 6
      const estimatedHeight = 360
      if (top + estimatedHeight > window.innerHeight - 12) {
        top = Math.max(12, r.top - estimatedHeight - 6)
      }
      setPos({ top, left, width })
    }

    place()
    window.addEventListener("resize", place)
    window.addEventListener("scroll", place, true)
    return () => {
      window.removeEventListener("resize", place)
      window.removeEventListener("scroll", place, true)
    }
  }, [open, anchorRef])

  if (!open || !mounted) return null

  // Portal to body so `fixed` is viewport-relative (Sheets use transform).
  return createPortal(
    <>
      <button
        type="button"
        className="fixed inset-0 z-[180] cursor-default"
        aria-label="Close calendar"
        onClick={onClose}
      />
      <div
        style={{ top: pos.top, left: pos.left, width: pos.width }}
        className={cn(
          "fixed z-[190] rounded-xl border bg-popover p-3 text-popover-foreground shadow-lg ring-1 ring-foreground/10",
          className,
        )}
      >
        {children}
      </div>
    </>,
    document.body,
  )
}

type AdminDateFieldProps = {
  label: string
  value: string
  onChange: (value: string) => void
  min?: string
  max?: string
  placeholder?: string
  className?: string
  allowClear?: boolean
}

/**
 * Custom date field for admin — avoids native iOS date inputs.
 * Mobile: bottom sheet. Desktop: anchored panel under the field.
 */
export function AdminDateField({
  label,
  value,
  onChange,
  min,
  max,
  placeholder = "Select date",
  className,
  allowClear = true,
}: AdminDateFieldProps) {
  const isMobile = useIsMobile()
  const [open, setOpen] = React.useState(false)
  const triggerRef = React.useRef<HTMLDivElement>(null)
  const selected = value ? parseDateInputValue(value) : null
  const minDate = min ? parseDateInputValue(min) : null
  const maxDate = max ? parseDateInputValue(max) : null

  const [view, setView] = React.useState(() => {
    const base = selected ?? new Date()
    return new Date(base.getFullYear(), base.getMonth(), 1)
  })

  React.useEffect(() => {
    if (!open) return
    const base = value ? parseDateInputValue(value) : null
    const next = base ?? new Date()
    setView(new Date(next.getFullYear(), next.getMonth(), 1))
  }, [open, value])

  const display = formatDateDisplay(value)

  const calendar = (
    <MonthGrid
      view={view}
      selected={selected}
      minDate={minDate}
      maxDate={maxDate}
      onViewChange={setView}
      compact={!isMobile}
      onSelectDay={(day) => {
        onChange(toDateInputValue(day))
        setOpen(false)
      }}
    />
  )

  const actions = (
    <div className="mt-3 flex gap-2">
      {allowClear ? (
        <Button
          type="button"
          variant="outline"
          className={cn(
            "flex-1 touch-manipulation",
            isMobile ? "h-11" : "h-8 text-xs",
          )}
          onClick={() => {
            onChange("")
            setOpen(false)
          }}
        >
          Clear
        </Button>
      ) : null}
      <Button
        type="button"
        className={cn(
          "flex-1 touch-manipulation",
          isMobile ? "h-11" : "h-8 text-xs",
        )}
        onClick={() => {
          onChange(toDateInputValue(new Date()))
          setOpen(false)
        }}
      >
        Today
      </Button>
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
            !display && "text-muted-foreground",
          )}
          onClick={() => setOpen((v) => !v)}
        >
          <CalendarIcon className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate text-base md:text-sm">
            {display ?? placeholder}
          </span>
        </Button>
        {allowClear && value ? (
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-11 shrink-0 touch-manipulation md:size-10"
            aria-label={`Clear ${label}`}
            onClick={() => onChange("")}
          >
            <XIcon className="size-4" />
          </Button>
        ) : null}
      </div>

      {!isMobile ? (
        <DesktopPanel
          open={open}
          onClose={() => setOpen(false)}
          anchorRef={triggerRef}
        >
          {calendar}
          {actions}
        </DesktopPanel>
      ) : (
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent
            side="bottom"
            className="max-h-[min(92dvh,40rem)] gap-0 rounded-t-2xl p-0"
          >
            <SheetHeader className="border-b p-4 pr-12 text-left">
              <SheetTitle className="text-base">{label}</SheetTitle>
            </SheetHeader>
            <div className="flex flex-col gap-4 overflow-y-auto overscroll-contain p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              {calendar}
              {actions}
            </div>
          </SheetContent>
        </Sheet>
      )}
    </div>
  )
}

type AdminDateTimeFieldProps = {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  allowClear?: boolean
}

/**
 * Custom datetime field (YYYY-MM-DDTHH:mm) for admin booking forms.
 * Mobile: bottom sheet. Desktop: anchored panel under the field.
 */
export function AdminDateTimeField({
  label,
  value,
  onChange,
  placeholder = "Select date & time",
  className,
  allowClear = false,
}: AdminDateTimeFieldProps) {
  const isMobile = useIsMobile()
  const [open, setOpen] = React.useState(false)
  const triggerRef = React.useRef<HTMLDivElement>(null)
  const parsed = value ? parseDateTimeInputValue(value) : null

  const [view, setView] = React.useState(() => {
    const base = parsed ?? new Date()
    return new Date(base.getFullYear(), base.getMonth(), 1)
  })
  const [selectedDay, setSelectedDay] = React.useState<Date>(() =>
    startOfDay(parsed ?? new Date()),
  )
  const [hour, setHour] = React.useState(() => parsed?.getHours() ?? 12)
  const [minute, setMinute] = React.useState(() => {
    const raw = parsed ? Math.round(parsed.getMinutes() / 5) * 5 : 0
    return raw === 60 ? 0 : raw
  })

  React.useEffect(() => {
    if (!open) return
    const base = value ? parseDateTimeInputValue(value) : null
    const next = base ?? new Date()
    setView(new Date(next.getFullYear(), next.getMonth(), 1))
    setSelectedDay(startOfDay(next))
    setHour(next.getHours())
    const raw = Math.round(next.getMinutes() / 5) * 5
    setMinute(raw === 60 ? 0 : raw)
  }, [open, value])

  const display = formatDateTimeDisplay(value)

  function confirm() {
    const next = new Date(selectedDay)
    next.setHours(hour, minute, 0, 0)
    onChange(toDateTimeInputValue(next))
    setOpen(false)
  }

  const body = (
    <>
      <MonthGrid
        view={view}
        selected={selectedDay}
        minDate={null}
        maxDate={null}
        onViewChange={setView}
        onSelectDay={setSelectedDay}
        compact={!isMobile}
      />

      <div
        className={cn(
          "grid grid-cols-2",
          isMobile ? "mt-4 gap-3" : "mt-3 gap-2",
        )}
      >
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Hour</span>
          <select
            value={hour}
            onChange={(e) => setHour(Number(e.target.value))}
            className={cn(
              "rounded-lg border border-input bg-transparent outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
              isMobile
                ? "h-11 px-3 text-base"
                : "h-8 px-2 text-xs",
            )}
          >
            {HOURS.map((h) => (
              <option key={h} value={h}>
                {pad2(h)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Minute</span>
          <select
            value={minute}
            onChange={(e) => setMinute(Number(e.target.value))}
            className={cn(
              "rounded-lg border border-input bg-transparent outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
              isMobile
                ? "h-11 px-3 text-base"
                : "h-8 px-2 text-xs",
            )}
          >
            {MINUTES.map((m) => (
              <option key={m} value={m}>
                {pad2(m)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <Button
        type="button"
        className={cn(
          "w-full touch-manipulation",
          isMobile ? "mt-4 h-11" : "mt-3 h-8 text-xs",
        )}
        onClick={confirm}
      >
        Confirm
      </Button>
    </>
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
            !display && "text-muted-foreground",
          )}
          onClick={() => setOpen((v) => !v)}
        >
          <CalendarIcon className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate text-base md:text-sm">
            {display ?? placeholder}
          </span>
        </Button>
        {allowClear && value ? (
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-11 shrink-0 touch-manipulation md:size-10"
            aria-label={`Clear ${label}`}
            onClick={() => onChange("")}
          >
            <XIcon className="size-4" />
          </Button>
        ) : null}
      </div>

      {!isMobile ? (
        <DesktopPanel
          open={open}
          onClose={() => setOpen(false)}
          anchorRef={triggerRef}
        >
          {body}
        </DesktopPanel>
      ) : (
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent
            side="bottom"
            className="max-h-[min(92dvh,44rem)] gap-0 rounded-t-2xl p-0"
          >
            <SheetHeader className="border-b p-4 pr-12 text-left">
              <SheetTitle className="text-base">{label}</SheetTitle>
            </SheetHeader>
            <div className="overflow-y-auto overscroll-contain p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              {body}
            </div>
          </SheetContent>
        </Sheet>
      )}
    </div>
  )
}
