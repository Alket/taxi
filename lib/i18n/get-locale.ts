import { cookies, headers } from "next/headers"

import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  LOCALE_HEADER,
  type Locale,
  isLocale,
} from "@/lib/i18n/locales"

/** Server-side locale from middleware header, then cookie, then default. */
export async function getRequestLocale(): Promise<Locale> {
  const headerStore = await headers()
  const fromHeader = headerStore.get(LOCALE_HEADER)
  if (isLocale(fromHeader)) return fromHeader

  const cookieStore = await cookies()
  const fromCookie = cookieStore.get(LOCALE_COOKIE)?.value
  if (isLocale(fromCookie)) return fromCookie

  return DEFAULT_LOCALE
}
