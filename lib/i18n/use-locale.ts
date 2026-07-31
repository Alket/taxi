"use client"

import { usePathname } from "next/navigation"
import { useCallback, useSyncExternalStore } from "react"

import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  type Locale,
  isLocale,
  localeFromPathname,
} from "@/lib/i18n/locales"
import { t, type MessageKey } from "@/lib/i18n/t"

const LOCALE_CHANGE_EVENT = "localechange"

function readCookieLocale(): Locale | null {
  if (typeof document === "undefined") return null
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${LOCALE_COOKIE}=([^;]*)`),
  )
  const value = match?.[1] ? decodeURIComponent(match[1]) : null
  return isLocale(value) ? value : null
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

/** Persist locale for middleware/client chrome and notify listeners. */
export function setClientLocale(locale: Locale) {
  if (typeof document === "undefined") return
  document.cookie = `${LOCALE_COOKIE}=${encodeURIComponent(locale)}; Path=/; Max-Age=31536000; SameSite=Lax`
  window.dispatchEvent(new Event(LOCALE_CHANGE_EVENT))
}

/**
 * Client locale from URL prefix (`/it/...`), falling back to NEXT_LOCALE cookie
 * when middleware rewrite leaves usePathname unprefixed.
 */
export function useLocale(): Locale {
  const pathname = usePathname() || "/"
  const fromPath = localeFromPathname(pathname)
  const fromCookie = useSyncExternalStore(
    subscribeLocale,
    readCookieLocale,
    () => null,
  )

  if (fromPath !== DEFAULT_LOCALE) return fromPath
  return fromCookie ?? DEFAULT_LOCALE
}

/** Convenience: `const t = useT(); t("nav.book")` */
export function useT() {
  const locale = useLocale()
  return useCallback(
    (key: MessageKey | string, vars?: Record<string, string | number>) =>
      t(locale, key, vars),
    [locale],
  )
}
