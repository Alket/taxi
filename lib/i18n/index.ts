export {
  LOCALES,
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  LOCALE_HEADER,
  LOCALE_LABELS,
  type Locale,
  isLocale,
  isPrefixedLocale,
  localePath,
  stripLocalePrefix,
  localeFromPathname,
} from "@/lib/i18n/locales"

export { getRequestLocale } from "@/lib/i18n/get-locale"
export { useLocale, useT, setClientLocale } from "@/lib/i18n/use-locale"
export { t, getMessages, type MessageKey } from "@/lib/i18n/t"
