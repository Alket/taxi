"use client"

import * as React from "react"
import {
  ChevronLeftIcon,
  ChevronRightIcon,
} from "lucide-react"

import { useIsMobile } from "@/hooks/use-mobile"
import { useBodyScrollLock } from "@/hooks/use-body-scroll-lock"
import {
  earliestPickupAt,
  MIN_PICKUP_LEAD_LABEL,
} from "@/lib/pickup-lead-time"
import { APP_TIMEZONE } from "@/lib/format"
import { useT } from "@/lib/i18n/use-locale"
import {
  getZonedWallTime,
  zonedWallTimeToIso,
} from "@/lib/timezone"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

const WEEKDAYS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"] as const

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

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

type HeroDateTimePickerProps = {
  value: string | null
  onChange: (iso: string) => void
  open: boolean
  onOpenChange: (open: boolean) => void
  trigger?: React.ReactNode
  minDate?: Date
  variant?: "hero" | "compact"
  /** Opens calendar in a sheet above dialogs (fixes scroll when nested in modals). */
  inDialog?: boolean
  /** Called after Confirm — open the next sheet first so scroll-lock stays engaged. */
  onAfterConfirm?: () => void
}

function CalendarPanel({
  value,
  onChange,
  onOpenChange,
  onAfterConfirm,
  earliest,
  open,
  layout,
}: {
  value: string | null
  onChange: (iso: string) => void
  onOpenChange: (open: boolean) => void
  onAfterConfirm?: () => void
  earliest: Date
  open: boolean
  layout: "dropdown" | "sheet"
}) {
  const tr = useT()
  const initialWall = getZonedWallTime(value ? new Date(value) : earliest)
  const [view, setView] = React.useState(
    () => new Date(initialWall.year, initialWall.month - 1, 1),
  )
  const [selectedDay, setSelectedDay] = React.useState<Date>(
    () => new Date(initialWall.year, initialWall.month - 1, initialWall.day),
  )
  const [hour, setHour] = React.useState<number | null>(() =>
    value ? initialWall.hour : null,
  )
  const [minute, setMinute] = React.useState<number | null>(() => {
    if (!value) return null
    const raw = Math.floor(initialWall.minute / 5) * 5
    return raw === 60 ? 0 : raw
  })
  const [timeError, setTimeError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!open) return
    const base = value ? new Date(value) : earliest
    const safe = base.getTime() < earliest.getTime() ? earliest : base
    const wall = getZonedWallTime(safe)
    setView(new Date(wall.year, wall.month - 1, 1))
    setSelectedDay(new Date(wall.year, wall.month - 1, wall.day))
    if (value) {
      setHour(wall.hour)
      const snapped = Math.floor(wall.minute / 5) * 5
      setMinute(snapped === 60 ? 0 : snapped)
    } else {
      setHour(null)
      setMinute(null)
    }
    setTimeError(null)
  }, [open, value, earliest])

  const earliestWall = getZonedWallTime(earliest)
  const today = new Date(
    earliestWall.year,
    earliestWall.month - 1,
    earliestWall.day,
  )
  const year = view.getFullYear()
  const month = view.getMonth()
  const firstDow = new Date(year, month, 1).getDay()
  const totalDays = daysInMonth(year, month)

  const cells: (number | null)[] = []
  for (let i = 0; i < firstDow; i++) cells.push(null)
  for (let d = 1; d <= totalDays; d++) cells.push(d)

  function slotIso(h: number, m: number) {
    return zonedWallTimeToIso(
      selectedDay.getFullYear(),
      selectedDay.getMonth(),
      selectedDay.getDate(),
      h,
      m,
    )
  }

  function isSlotDisabled(h: number, m: number) {
    return new Date(slotIso(h, m)).getTime() < earliest.getTime()
  }

  function confirm() {
    if (hour == null || minute == null) {
      setTimeError(tr("book.selectTime"))
      return
    }
    let nextIso = slotIso(hour, minute)
    if (new Date(nextIso).getTime() < earliest.getTime()) {
      const wall = getZonedWallTime(earliest)
      const snapped = Math.ceil(wall.minute / 5) * 5
      if (snapped === 60) {
        nextIso = zonedWallTimeToIso(
          wall.year,
          wall.month - 1,
          wall.day,
          wall.hour + 1,
          0,
        )
      } else {
        nextIso = zonedWallTimeToIso(
          wall.year,
          wall.month - 1,
          wall.day,
          wall.hour,
          snapped,
        )
      }
    }
    onChange(nextIso)
    if (onAfterConfirm) {
      // Parent covers the viewport then closes this sheet — avoid closing
      // first or the page behind (e.g. homepage hero) flashes between steps.
      onAfterConfirm()
      return
    }
    onOpenChange(false)
  }

  const monthLabel = view.toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  })

  const allHours = Array.from({ length: 24 }, (_, i) => i)
  const allMinutes = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]
  // Hide past slots entirely (don't list disabled 00–08… when today is selected).
  const hours = allHours.filter((h) =>
    allMinutes.some((m) => !isSlotDisabled(h, m)),
  )
  const minutes =
    hour == null
      ? []
      : allMinutes.filter((m) => !isSlotDisabled(hour, m))

  React.useEffect(() => {
    if (hour != null && !hours.includes(hour)) {
      setHour(null)
      setMinute(null)
      return
    }
    if (minute != null && hour != null && !minutes.includes(minute)) {
      setMinute(null)
    }
    // Re-evaluate when the selected day / earliest window changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDay, earliest, hour, minute])

  const sheet = layout === "sheet"
  const timeSelectClass = cn(
    "h-10 rounded-lg border bg-muted px-2 text-base font-bold text-brand outline-none sm:h-8 md:text-xs",
    timeError
      ? "border-red-500 focus:border-red-500"
      : "border-border focus:border-brand-accent",
  )

  return (
    <div className={cn(sheet && "flex min-h-0 flex-1 flex-col")}>
      <div className={cn("mb-4 flex items-center justify-between", sheet && "shrink-0")}>
        <button
          type="button"
          className="flex size-9 items-center justify-center rounded-full border border-border text-muted-foreground touch-manipulation hover:bg-muted hover:text-brand sm:size-7"
          onClick={() => setView(new Date(year, month - 1, 1))}
          aria-label="Previous month"
        >
          <ChevronLeftIcon className="size-4 sm:size-3.5" />
        </button>
        <p className="text-[13px] font-bold tracking-wide text-brand uppercase">
          {monthLabel}
        </p>
        <button
          type="button"
          className="flex size-9 items-center justify-center rounded-full border border-border text-muted-foreground touch-manipulation hover:bg-muted hover:text-brand sm:size-7"
          onClick={() => setView(new Date(year, month + 1, 1))}
          aria-label="Next month"
        >
          <ChevronRightIcon className="size-4 sm:size-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
        {WEEKDAYS.map((d) => (
          <div key={d} className="py-1">
            {d}
          </div>
        ))}
      </div>

      <div className={cn("mt-1 grid grid-cols-7 gap-0.5", sheet && "gap-1")}>
        {cells.map((day, idx) => {
          if (day == null) {
            return <div key={`e-${idx}`} className="aspect-square" />
          }
          const date = new Date(year, month, day)
          const disabled = date < today
          const selected = sameDay(date, selectedDay)
          return (
            <button
              key={day}
              type="button"
              disabled={disabled}
              onClick={() => {
                setSelectedDay(startOfDay(date))
                setHour(null)
                setMinute(null)
                setTimeError(null)
              }}
              className={cn(
                "flex aspect-square items-center justify-center rounded-full font-semibold transition-all touch-manipulation",
                sheet ? "text-base" : "text-xs",
                disabled && "cursor-not-allowed text-muted-foreground/40",
                !disabled &&
                  !selected &&
                  "text-brand hover:bg-muted hover:text-brand",
                selected && "bg-brand-accent text-white shadow-sm",
              )}
            >
              {day}
            </button>
          )
        })}
      </div>

      <div
        className={cn(
          "mt-5 flex items-center justify-between border-t border-border pt-4",
          sheet && "mt-auto shrink-0",
        )}
      >
        <span className="text-sm font-bold text-brand">{tr("book.time")}</span>
        <div className="flex items-center gap-1.5">
          <select
            aria-invalid={Boolean(timeError)}
            className={timeSelectClass}
            value={hour ?? ""}
            onChange={(e) => {
              const next = e.target.value
              setHour(next === "" ? null : Number(next))
              setMinute(null)
              setTimeError(null)
            }}
          >
            <option value="" disabled>
              --
            </option>
            {hours.map((h) => (
              <option key={h} value={h}>
                {String(h).padStart(2, "0")}
              </option>
            ))}
          </select>
          <span className="font-bold text-muted-foreground">:</span>
          <select
            aria-invalid={Boolean(timeError)}
            className={timeSelectClass}
            value={minute ?? ""}
            onChange={(e) => {
              const next = e.target.value
              setMinute(next === "" ? null : Number(next))
              setTimeError(null)
            }}
          >
            <option value="" disabled>
              --
            </option>
            {minutes.map((m) => (
              <option key={m} value={m}>
                {String(m).padStart(2, "0")}
              </option>
            ))}
          </select>
        </div>
      </div>

      {timeError ? (
        <p className="mt-2 text-[11px] font-semibold text-red-500">{timeError}</p>
      ) : (
        <p className="mt-2 text-[11px] font-semibold text-muted-foreground">
          {tr("book.minNotice", { lead: MIN_PICKUP_LEAD_LABEL })}
        </p>
      )}

      <Button
        type="button"
        className={cn(
          "mt-3 w-full rounded-xl bg-brand-accent text-sm font-bold text-white shadow-sm transition-all hover:bg-brand-accent-hover",
          sheet ? "h-12 shrink-0 text-base" : "h-11",
        )}
        onClick={confirm}
        disabled={hours.length === 0}
      >
        {tr("book.confirm")}
      </Button>
    </div>
  )
}

export function HeroDateTimePicker({
  value,
  onChange,
  open,
  onOpenChange,
  trigger,
  minDate,
  onAfterConfirm,
  inDialog = false,
  variant = "hero",
}: HeroDateTimePickerProps) {
  const isMobile = useIsMobile()
  useBodyScrollLock(isMobile && open && !inDialog)

  const earliest = React.useMemo(() => {
    const lead = earliestPickupAt()
    if (!minDate) return lead
    return minDate.getTime() > lead.getTime() ? minDate : lead
    // Recompute when the picker opens so the 1h window stays current.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minDate, open])

  const calendar = (
    <CalendarPanel
      value={value}
      onChange={onChange}
      onOpenChange={onOpenChange}
      onAfterConfirm={onAfterConfirm}
      earliest={earliest}
      open={open}
      layout="dropdown"
    />
  )

  if (inDialog) {
    return (
      <div className="flex flex-col gap-3">
        {trigger}
        {open && (
          <div className="rounded-xl border border-border bg-brand-surface p-4">
            {calendar}
          </div>
        )}
      </div>
    )
  }

  if (isMobile) {
    return (
      <div className="relative">
        {trigger}
        <Sheet open={open} onOpenChange={onOpenChange}>
          <SheetContent
            side="bottom"
            showCloseButton
            className="flex h-[100dvh] max-h-[100dvh] flex-col gap-0 rounded-none border-0 bg-brand-surface p-0 text-[color:var(--brand-ink)] data-[side=bottom]:h-[100dvh]"
          >
            <SheetHeader className="shrink-0 border-b border-border px-4 py-3 pr-14">
              <SheetTitle className="text-base font-bold text-brand">
                Pickup date & time
              </SheetTitle>
            </SheetHeader>
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <CalendarPanel
                value={value}
                onChange={onChange}
                onOpenChange={onOpenChange}
                onAfterConfirm={onAfterConfirm}
                earliest={earliest}
                open={open}
                layout="sheet"
              />
            </div>
          </SheetContent>
        </Sheet>
      </div>
    )
  }

  return (
    <div className="relative">
      {trigger}
      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[200] cursor-default"
            aria-label="Close date picker"
            onClick={() => onOpenChange(false)}
          />
          <div
            className={cn(
              "absolute top-[calc(100%+0.5rem)] left-0 z-[210] rounded-2xl border border-border bg-brand-surface p-4 shadow-[0_20px_60px_rgba(0,0,0,0.2)]",
              variant === "compact"
                ? "w-[min(100%,18.5rem)]"
                : "w-full",
            )}
          >
            {calendar}
          </div>
        </>
      )}
    </div>
  )
}

export function formatHeroDateLabel(iso: string | null) {
  if (!iso) return "Add date & time"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "Add date & time"
  const day = d.toLocaleDateString("en-GB", {
    weekday: "short",
    timeZone: APP_TIMEZONE,
  })
  const date = d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: APP_TIMEZONE,
  })
  const time = d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: APP_TIMEZONE,
  })
  return `${day}, ${date}, ${time}`
}
