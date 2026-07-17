"use client"

import * as React from "react"
import {
  ChevronLeftIcon,
  ChevronRightIcon,
} from "lucide-react"

import {
  earliestPickupAt,
  MIN_PICKUP_LEAD_LABEL,
} from "@/lib/pickup-lead-time"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

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
  trigger: React.ReactNode
}

export function HeroDateTimePicker({
  value,
  onChange,
  open,
  onOpenChange,
  trigger,
  minDate,
  variant = "hero",
}: HeroDateTimePickerProps & { minDate?: Date; variant?: "hero" | "compact" }) {
  const earliest = React.useMemo(() => {
    const lead = earliestPickupAt()
    if (!minDate) return lead
    return minDate.getTime() > lead.getTime() ? minDate : lead
    // Recompute when the picker opens so the 1h window stays current.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minDate, open])

  const initial = value ? new Date(value) : earliest
  const [view, setView] = React.useState(
    () => new Date(initial.getFullYear(), initial.getMonth(), 1),
  )
  const [selectedDay, setSelectedDay] = React.useState<Date>(() =>
    startOfDay(initial),
  )
  const [hour, setHour] = React.useState(() =>
    value ? initial.getHours() : earliest.getHours(),
  )
  const [minute, setMinute] = React.useState(() => {
    const raw = value
      ? Math.floor(initial.getMinutes() / 5) * 5
      : Math.ceil(earliest.getMinutes() / 5) * 5
    return raw === 60 ? 0 : raw
  })

  React.useEffect(() => {
    if (!open) return
    const base = value ? new Date(value) : earliest
    const safe =
      base.getTime() < earliest.getTime() ? earliest : base
    setView(new Date(safe.getFullYear(), safe.getMonth(), 1))
    setSelectedDay(startOfDay(safe))
    setHour(safe.getHours())
    setMinute(Math.floor(safe.getMinutes() / 5) * 5)
  }, [open, value, earliest])

  const today = startOfDay(earliest)
  const year = view.getFullYear()
  const month = view.getMonth()
  const firstDow = new Date(year, month, 1).getDay()
  const totalDays = daysInMonth(year, month)

  const cells: (number | null)[] = []
  for (let i = 0; i < firstDow; i++) cells.push(null)
  for (let d = 1; d <= totalDays; d++) cells.push(d)

  function slotDate(h: number, m: number) {
    const next = new Date(selectedDay)
    next.setHours(h, m, 0, 0)
    return next
  }

  function isSlotDisabled(h: number, m: number) {
    return slotDate(h, m).getTime() < earliest.getTime()
  }

  function confirm() {
    let next = slotDate(hour, minute)
    if (next.getTime() < earliest.getTime()) {
      next = new Date(earliest)
      // Snap up to the next 5-minute slot.
      const snapped = Math.ceil(next.getMinutes() / 5) * 5
      if (snapped === 60) {
        next.setHours(next.getHours() + 1, 0, 0, 0)
      } else {
        next.setMinutes(snapped, 0, 0)
      }
    }
    onChange(next.toISOString())
    onOpenChange(false)
  }

  const monthLabel = view.toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  })

  const hours = Array.from({ length: 24 }, (_, i) => i)
  const minutes = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]

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
              "absolute top-[calc(100%+0.5rem)] left-0 z-[210] w-full rounded-2xl border border-border bg-brand-surface p-4 shadow-[0_20px_60px_rgba(0,0,0,0.2)]"
            )}
          >
            <div className="mb-4 flex items-center justify-between">
              <button
                type="button"
                className="flex size-7 items-center justify-center rounded-full border border-border text-muted-foreground hover:bg-muted hover:text-brand"
                onClick={() =>
                  setView(new Date(year, month - 1, 1))
                }
                aria-label="Previous month"
              >
                <ChevronLeftIcon className="size-3.5" />
              </button>
              <p className="text-[13px] font-bold text-brand uppercase tracking-wide">
                {monthLabel}
              </p>
              <button
                type="button"
                className="flex size-7 items-center justify-center rounded-full border border-border text-muted-foreground hover:bg-muted hover:text-brand"
                onClick={() =>
                  setView(new Date(year, month + 1, 1))
                }
                aria-label="Next month"
              >
                <ChevronRightIcon className="size-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
              {WEEKDAYS.map((d) => (
                <div key={d} className="py-1">
                  {d}
                </div>
              ))}
            </div>

            <div className="mt-1 grid grid-cols-7 gap-0.5">
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
                    onClick={() => setSelectedDay(startOfDay(date))}
                    className={cn(
                      "flex aspect-square items-center justify-center rounded-full text-xs font-semibold transition-all",
                      disabled && "text-muted-foreground/40 cursor-not-allowed",
                      !disabled && !selected && "text-brand hover:bg-muted hover:text-brand",
                      selected && "bg-brand-accent text-white shadow-sm",
                    )}
                  >
                    {day}
                  </button>
                )
              })}
            </div>

            <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
              <span className="text-sm font-bold text-brand">
                Time
              </span>
              <div className="flex items-center gap-1.5">
                <select
                  className="h-8 rounded-lg border border-border bg-muted px-2 text-base font-bold text-brand outline-none focus:border-brand-accent md:text-xs"
                  value={hour}
                  onChange={(e) => setHour(Number(e.target.value))}
                >
                  {hours.map((h) => {
                    const hourDisabled = minutes.every((m) =>
                      isSlotDisabled(h, m),
                    )
                    return (
                      <option key={h} value={h} disabled={hourDisabled}>
                        {String(h).padStart(2, "0")}
                      </option>
                    )
                  })}
                </select>
                <span className="font-bold text-muted-foreground">:</span>
                <select
                  className="h-8 rounded-lg border border-border bg-muted px-2 text-base font-bold text-brand outline-none focus:border-brand-accent md:text-xs"
                  value={minute}
                  onChange={(e) => setMinute(Number(e.target.value))}
                >
                  {minutes.map((m) => (
                    <option key={m} value={m} disabled={isSlotDisabled(hour, m)}>
                      {String(m).padStart(2, "0")}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <p className="mt-2 text-[11px] font-semibold text-muted-foreground">
              Bookings need at least {MIN_PICKUP_LEAD_LABEL} notice.
            </p>

            <Button
              type="button"
              className="mt-3 h-11 w-full rounded-xl bg-brand-accent text-sm font-bold text-white hover:bg-brand-accent-hover shadow-sm transition-all"
              onClick={confirm}
              disabled={hours.every((h) =>
                minutes.every((m) => isSlotDisabled(h, m)),
              )}
            >
              Confirm
            </Button>
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
  const day = d.toLocaleDateString("en-GB", { weekday: "short" })
  const date = d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  })
  const time = d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
  return `${day}, ${date}, ${time}`
}
