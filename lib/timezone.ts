/** Business timezone for pickup / return times (Albania). */
export const APP_TIMEZONE = "Europe/Tirane"

type WallParts = {
  year: number
  month: number // 1-12
  day: number
  hour: number
  minute: number
  second: number
}

function zonedParts(date: Date, timeZone: string): WallParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date)

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "0"

  let hour = Number(get("hour"))
  if (hour === 24) hour = 0

  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour,
    minute: Number(get("minute")),
    second: Number(get("second")),
  }
}

/** Read year/month/day/hour/minute as shown in `timeZone`. */
export function getZonedWallTime(
  iso: string | Date,
  timeZone: string = APP_TIMEZONE,
): WallParts {
  return zonedParts(new Date(iso), timeZone)
}

/**
 * Build a UTC ISO string for a civil date/time in `timeZone`
 * (e.g. 10:00 in Europe/Tirane → correct Instant).
 */
export function zonedWallTimeToIso(
  year: number,
  monthIndex: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string = APP_TIMEZONE,
): string {
  const utcGuess = Date.UTC(year, monthIndex, day, hour, minute, 0)
  let instant = utcGuess

  for (let i = 0; i < 3; i++) {
    const shown = zonedParts(new Date(instant), timeZone)
    const asIfUtc = Date.UTC(
      shown.year,
      shown.month - 1,
      shown.day,
      shown.hour,
      shown.minute,
      shown.second,
    )
    instant += utcGuess - asIfUtc
  }

  return new Date(instant).toISOString()
}
