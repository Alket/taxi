"use client"

import { useCallback, useSyncExternalStore } from "react"

import driverEn from "@/messages/driver-en.json"
import driverSq from "@/messages/driver-sq.json"
import { APP_TIMEZONE } from "@/lib/timezone"

export const DRIVER_LOCALES = ["en", "sq"] as const
export type DriverLocale = (typeof DRIVER_LOCALES)[number]

export const DEFAULT_DRIVER_LOCALE: DriverLocale = "en"
export const DRIVER_LOCALE_COOKIE = "DRIVER_LOCALE"

export const DRIVER_LOCALE_LABELS: Record<
  DriverLocale,
  { label: string; short: string }
> = {
  en: { label: "English", short: "EN" },
  sq: { label: "Shqip", short: "SQ" },
}

/** BCP 47 tags for Intl date/number formatting in the driver panel. */
export const DRIVER_INTL_LOCALE: Record<DriverLocale, string> = {
  en: "en-GB",
  sq: "sq-AL",
}

const SQ_WEEKDAY_SHORT = [
  "die",
  "hën",
  "mar",
  "mër",
  "enj",
  "pre",
  "sht",
] as const

const SQ_WEEKDAY_LONG = [
  "e diel",
  "e hënë",
  "e martë",
  "e mërkurë",
  "e enjte",
  "e premte",
  "e shtunë",
] as const

const SQ_MONTH_SHORT = [
  "jan",
  "shk",
  "mar",
  "pri",
  "maj",
  "qer",
  "kor",
  "gush",
  "sht",
  "tet",
  "nën",
  "dhj",
] as const

const SQ_MONTH_LONG = [
  "janar",
  "shkurt",
  "mars",
  "prill",
  "maj",
  "qershor",
  "korrik",
  "gusht",
  "shtator",
  "tetor",
  "nëntor",
  "dhjetor",
] as const

/** Parts of `value` in Europe/Tirane (weekday 0=Sun … 6=Sat). */
function tiraneDateParts(value: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIMEZONE,
    weekday: "short",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(value))
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? ""
  const weekdayIndex = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(
    get("weekday"),
  )
  return {
    weekdayIndex: weekdayIndex >= 0 ? weekdayIndex : 0,
    day: get("day"),
    monthIndex: Number(get("month")) - 1,
    hour: get("hour").padStart(2, "0"),
    minute: get("minute").padStart(2, "0"),
  }
}

const EN_WEEKDAY_LONG = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const

const EN_MONTH_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const

/** Sunday-first short weekday labels for calendar grids (matches week start). */
export function driverWeekdayShortLabels(locale: DriverLocale): string[] {
  if (locale === "sq") return [...SQ_WEEKDAY_SHORT]
  // 2021-01-03 was a Sunday in local interpretation via UTC noon.
  const sunday = new Date(Date.UTC(2021, 0, 3, 12, 0, 0))
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(sunday)
    day.setUTCDate(sunday.getUTCDate() + i)
    return new Intl.DateTimeFormat("en-GB", { weekday: "short" }).format(day)
  })
}

/** Pickup-style label: e.g. en "Sunday 30 August, 14:01" / sq "E diel 30 gusht, 14:01". */
export function formatDriverDateTime(
  value: string | null | undefined,
  locale: DriverLocale,
): string {
  if (!value) return "—"
  const p = tiraneDateParts(value)
  if (locale === "sq") {
    const weekday = SQ_WEEKDAY_LONG[p.weekdayIndex] ?? SQ_WEEKDAY_LONG[0]
    const month = SQ_MONTH_LONG[p.monthIndex] ?? SQ_MONTH_LONG[0]
    const raw = `${weekday} ${p.day} ${month}, ${p.hour}:${p.minute}`
    return raw.charAt(0).toLocaleUpperCase("sq-AL") + raw.slice(1)
  }
  const weekday = EN_WEEKDAY_LONG[p.weekdayIndex] ?? EN_WEEKDAY_LONG[0]
  const month = EN_MONTH_LONG[p.monthIndex] ?? EN_MONTH_LONG[0]
  return `${weekday} ${p.day} ${month}, ${p.hour}:${p.minute}`
}

type MessageDict = Record<string, string>

const CATALOGS: Record<DriverLocale, MessageDict> = {
  en: driverEn,
  sq: driverSq,
}

export type DriverMessageKey = keyof typeof driverEn

export function isDriverLocale(
  value: string | null | undefined,
): value is DriverLocale {
  return Boolean(value && (DRIVER_LOCALES as readonly string[]).includes(value))
}

function interpolate(
  value: string,
  vars?: Record<string, string | number>,
): string {
  if (!vars) return value
  let result = value
  for (const [name, replacement] of Object.entries(vars)) {
    result = result.replaceAll(`{${name}}`, String(replacement))
  }
  return result
}

/** Translate a driver-panel UI string. Falls back to English, then the key. */
export function driverT(
  locale: DriverLocale,
  key: DriverMessageKey | string,
  vars?: Record<string, string | number>,
): string {
  const dict = CATALOGS[locale] ?? CATALOGS[DEFAULT_DRIVER_LOCALE]
  const value =
    dict[key] ?? CATALOGS[DEFAULT_DRIVER_LOCALE][key] ?? String(key)
  return interpolate(value, vars)
}

const LOCALE_CHANGE_EVENT = "driverlocalechange"

function readCookieLocale(): DriverLocale | null {
  if (typeof document === "undefined") return null
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${DRIVER_LOCALE_COOKIE}=([^;]*)`),
  )
  const value = match?.[1] ? decodeURIComponent(match[1]) : null
  return isDriverLocale(value) ? value : null
}

function subscribeLocale(onStoreChange: () => void) {
  const handler = () => onStoreChange()
  window.addEventListener("focus", handler)
  window.addEventListener(LOCALE_CHANGE_EVENT, handler)
  return () => {
    window.removeEventListener("focus", handler)
    window.removeEventListener(LOCALE_CHANGE_EVENT, handler)
  }
}

/** Persist driver locale and notify listeners. */
export function setDriverLocale(locale: DriverLocale) {
  if (typeof document === "undefined") return
  document.cookie = `${DRIVER_LOCALE_COOKIE}=${encodeURIComponent(locale)}; Path=/; Max-Age=31536000; SameSite=Lax`
  window.dispatchEvent(new Event(LOCALE_CHANGE_EVENT))
}

export function useDriverLocale(): DriverLocale {
  const fromCookie = useSyncExternalStore(
    subscribeLocale,
    readCookieLocale,
    () => null,
  )
  return fromCookie ?? DEFAULT_DRIVER_LOCALE
}

/** Convenience: `const t = useDriverT(); t("nav.trips")` */
export function useDriverT() {
  const locale = useDriverLocale()
  return useCallback(
    (key: DriverMessageKey | string, vars?: Record<string, string | number>) =>
      driverT(locale, key, vars),
    [locale],
  )
}
