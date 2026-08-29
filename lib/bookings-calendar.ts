import { toDateInputValue } from "@/components/admin/date-field"
import { getZonedWallTime } from "@/lib/timezone"
import type { Booking } from "@/lib/types"

export const CALENDAR_PAGE_SIZE = 500
export const CALENDAR_WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"] as const

export const CALENDAR_VIEW_OPTIONS = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
] as const

export type CalendarViewMode = (typeof CALENDAR_VIEW_OPTIONS)[number]["value"]

export function isCalendarViewMode(
  value: string | null,
): value is CalendarViewMode {
  return CALENDAR_VIEW_OPTIONS.some((o) => o.value === value)
}

function pad2(n: number) {
  return String(n).padStart(2, "0")
}

export function dateKeyFromParts(year: number, month: number, day: number) {
  return `${year}-${pad2(month)}-${pad2(day)}`
}

export function wallDateKey(iso: string) {
  const wall = getZonedWallTime(iso)
  return dateKeyFromParts(wall.year, wall.month, wall.day)
}

export function parseDateKey(key: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return null
  const [y, m, d] = key.split("-").map(Number)
  const date = new Date(y!, m! - 1, d!, 12, 0, 0, 0)
  if (
    date.getFullYear() !== y ||
    date.getMonth() !== m! - 1 ||
    date.getDate() !== d
  ) {
    return null
  }
  return date
}

function startOfDay(d: Date) {
  const x = new Date(d)
  x.setHours(12, 0, 0, 0)
  return x
}

export function addDays(d: Date, n: number) {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

export function startOfWeekSunday(d: Date) {
  const x = startOfDay(d)
  x.setDate(x.getDate() - x.getDay())
  return x
}

export function maxDateKey(a: string, b: string) {
  return a > b ? a : b
}

export function minDateKey(a: string, b: string) {
  return a < b ? a : b
}

/**
 * Visible calendar window for day / week / month.
 * Month includes leading/trailing days so the Su–Sa grid is complete.
 */
export function visibleRange(
  view: CalendarViewMode,
  cursor: Date,
): { from: string; to: string; days: string[] } {
  if (view === "day") {
    const key = toDateInputValue(cursor)
    return { from: key, to: key, days: [key] }
  }

  if (view === "week") {
    const start = startOfWeekSunday(cursor)
    const days = Array.from({ length: 7 }, (_, i) =>
      toDateInputValue(addDays(start, i)),
    )
    return { from: days[0]!, to: days[6]!, days }
  }

  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1, 12)
  const gridStart = startOfWeekSunday(first)
  const last = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0, 12)
  const gridEnd = addDays(startOfWeekSunday(last), 6)
  const days: string[] = []
  for (
    let d = new Date(gridStart);
    d.getTime() <= gridEnd.getTime();
    d = addDays(d, 1)
  ) {
    days.push(toDateInputValue(d))
  }
  return { from: days[0]!, to: days[days.length - 1]!, days }
}

/** Intersect visible window with optional filter From/To (YYYY-MM-DD). */
export function intersectFetchRange(
  visibleFrom: string,
  visibleTo: string,
  filterFrom: string,
  filterTo: string,
): { from: string; to: string; invalid: boolean } {
  const from = filterFrom ? maxDateKey(visibleFrom, filterFrom) : visibleFrom
  const to = filterTo ? minDateKey(visibleTo, filterTo) : visibleTo
  return { from, to, invalid: from > to }
}

export function groupBookingsByDay(bookings: Booking[]) {
  const map = new Map<string, Booking[]>()
  for (const booking of bookings) {
    const key = wallDateKey(booking.pickupDateTime)
    const list = map.get(key)
    if (list) list.push(booking)
    else map.set(key, [booking])
  }
  return map
}

/** Mirror of admin bookings API pageSize cap for calendar loads. */
export function calendarApiMaxPageSize(
  dateFrom: string | null,
  dateTo: string | null,
): number {
  if (
    dateFrom &&
    dateTo &&
    /^\d{4}-\d{2}-\d{2}$/.test(dateFrom) &&
    /^\d{4}-\d{2}-\d{2}$/.test(dateTo)
  ) {
    return 500
  }
  return 100
}
