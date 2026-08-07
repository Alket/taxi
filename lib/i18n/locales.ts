export const LOCALES = ["en", "it", "de", "pl", "tr", "uk", "ru"] as const

export type Locale = (typeof LOCALES)[number]

export const DEFAULT_LOCALE: Locale = "en"

export const LOCALE_COOKIE = "NEXT_LOCALE"
export const LOCALE_HEADER = "x-locale"

export const LOCALE_LABELS: Record<Locale, { label: string; short: string }> = {
  en: { label: "English", short: "EN" },
  it: { label: "Italian", short: "IT" },
  de: { label: "German", short: "DE" },
  pl: { label: "Polish", short: "PL" },
  tr: { label: "Turkish", short: "TR" },
  uk: { label: "Ukrainian", short: "UK" },
  ru: { label: "Russian", short: "RU" },
}

export function isLocale(value: string | null | undefined): value is Locale {
  return Boolean(value && (LOCALES as readonly string[]).includes(value))
}

/** Non-default locales that appear as a URL path prefix. */
export function isPrefixedLocale(value: string): value is Exclude<Locale, "en"> {
  return isLocale(value) && value !== DEFAULT_LOCALE
}

/**
 * Build a localized public path.
 * English stays unprefixed; other locales get `/it/...` style prefixes.
 */
export function localePath(path: string, locale: Locale): string {
  const raw = path.startsWith("/") ? path : `/${path}`
  const [pathnamePart, query = ""] = raw.split("?")
  const hashIndex = pathnamePart.indexOf("#")
  const pathname =
    hashIndex >= 0 ? pathnamePart.slice(0, hashIndex) : pathnamePart
  const hash = hashIndex >= 0 ? pathnamePart.slice(hashIndex) : ""
  const querySuffix = query ? `?${query}` : ""

  const stripped = stripLocalePrefix(pathname)
  if (locale === DEFAULT_LOCALE) {
    return `${stripped === "" ? "/" : stripped}${querySuffix}${hash}`
  }
  if (stripped === "/") {
    return `/${locale}${querySuffix}${hash}`
  }
  return `/${locale}${stripped}${querySuffix}${hash}`
}

/** Remove a leading locale prefix from a pathname if present. */
export function stripLocalePrefix(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean)
  if (segments.length === 0) return "/"
  if (isPrefixedLocale(segments[0])) {
    const rest = segments.slice(1).join("/")
    return rest ? `/${rest}` : "/"
  }
  return pathname.startsWith("/") ? pathname : `/${pathname}`
}

/** Build `alternates.canonical` + `alternates.languages` for a given path/locale (hreflang). */
export function localizedAlternates(path: string, locale: Locale) {
  const languages: Record<string, string> = {}
  for (const code of LOCALES) {
    languages[code] = localePath(path, code)
  }
  languages["x-default"] = localePath(path, DEFAULT_LOCALE)
  return {
    canonical: localePath(path, locale),
    languages,
  }
}

/** Detect locale from a pathname (`/it/foo` → it, `/foo` → en). */
export function localeFromPathname(pathname: string): Locale {
  const first = pathname.split("/").filter(Boolean)[0]
  if (isPrefixedLocale(first ?? "")) return first as Locale
  return DEFAULT_LOCALE
}
