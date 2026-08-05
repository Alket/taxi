"use client"

import { useCallback, useSyncExternalStore } from "react"

import driverEn from "@/messages/driver-en.json"
import driverSq from "@/messages/driver-sq.json"

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
