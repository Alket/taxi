/** GDPR-style cookie consent storage and helpers (client). */

export const COOKIE_CONSENT_KEY = "cookie_consent_v2"
export const COOKIE_CONSENT_EVENT = "cookieconsentchange"
export const OPEN_COOKIE_PREFERENCES_EVENT = "opencookiepreferences"

export type CookieConsentCategories = {
  necessary: true
  analytics: boolean
  marketing: boolean
}

export type CookieConsentState = {
  version: 2
  updatedAt: string
  /** True only after an explicit Accept / Reject / Save click. */
  decided: true
  categories: CookieConsentCategories
}

export const DEFAULT_REJECTED_CONSENT: CookieConsentCategories = {
  necessary: true,
  analytics: false,
  marketing: false,
}

export const DEFAULT_ACCEPTED_CONSENT: CookieConsentCategories = {
  necessary: true,
  analytics: true,
  marketing: true,
}

/** Cached snapshot for useSyncExternalStore (stable reference). */
let cachedSnapshot: CookieConsentState | null | undefined
let cachedRaw: string | null | undefined

function safeLocalStorageGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function safeLocalStorageSet(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // Private mode / blocked storage — fall back to cookie only.
  }
}

function readConsentCookie(): string | null {
  try {
    const match = document.cookie.match(
      new RegExp(`(?:^|; )${COOKIE_CONSENT_KEY}=([^;]*)`),
    )
    return match?.[1] ? decodeURIComponent(match[1]) : null
  } catch {
    return null
  }
}

export function parseCookieConsent(raw: string | null): CookieConsentState | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<CookieConsentState>
    if (parsed?.version !== 2 || parsed.decided !== true || !parsed.categories) {
      return null
    }
    return {
      version: 2,
      decided: true,
      updatedAt: parsed.updatedAt || new Date().toISOString(),
      categories: {
        necessary: true,
        analytics: Boolean(parsed.categories.analytics),
        marketing: Boolean(parsed.categories.marketing),
      },
    }
  } catch {
    return null
  }
}

function readRawConsent(): string | null {
  if (typeof window === "undefined") return null
  return safeLocalStorageGet(COOKIE_CONSENT_KEY) || readConsentCookie()
}

/** Stable getSnapshot for useSyncExternalStore. */
export function getCookieConsentSnapshot(): CookieConsentState | null {
  if (typeof window === "undefined") return null
  const raw = readRawConsent()
  if (raw === cachedRaw) {
    return cachedSnapshot ?? null
  }
  cachedRaw = raw
  cachedSnapshot = parseCookieConsent(raw)
  return cachedSnapshot
}

export function readCookieConsent(): CookieConsentState | null {
  return getCookieConsentSnapshot()
}

function invalidateConsentCache() {
  cachedRaw = undefined
  cachedSnapshot = undefined
}

export function writeCookieConsent(
  categories: Omit<CookieConsentCategories, "necessary"> & {
    necessary?: true
  },
): CookieConsentState {
  const state: CookieConsentState = {
    version: 2,
    decided: true,
    updatedAt: new Date().toISOString(),
    categories: {
      necessary: true,
      analytics: Boolean(categories.analytics),
      marketing: Boolean(categories.marketing),
    },
  }

  if (typeof window !== "undefined") {
    const payload = JSON.stringify(state)
    safeLocalStorageSet(COOKIE_CONSENT_KEY, payload)
    const maxAge = 60 * 60 * 24 * 365
    document.cookie = `${COOKIE_CONSENT_KEY}=${encodeURIComponent(
      payload,
    )}; Path=/; Max-Age=${maxAge}; SameSite=Lax`
    invalidateConsentCache()
    cachedRaw = payload
    cachedSnapshot = state
    window.dispatchEvent(
      new CustomEvent(COOKIE_CONSENT_EVENT, { detail: state }),
    )
  }

  return state
}

export function clearCookieConsent() {
  if (typeof window === "undefined") return
  try {
    window.localStorage.removeItem(COOKIE_CONSENT_KEY)
    window.localStorage.removeItem("cookie_consent_v1")
  } catch {
    // ignore
  }
  document.cookie = `${COOKIE_CONSENT_KEY}=; Path=/; Max-Age=0; SameSite=Lax`
  document.cookie = `cookie_consent_v1=; Path=/; Max-Age=0; SameSite=Lax`
  invalidateConsentCache()
  window.dispatchEvent(new CustomEvent(COOKIE_CONSENT_EVENT, { detail: null }))
}

export function hasAnalyticsConsent(): boolean {
  return Boolean(readCookieConsent()?.categories.analytics)
}

export function hasMarketingConsent(): boolean {
  return Boolean(readCookieConsent()?.categories.marketing)
}

/** True when analytics and/or marketing cookies were accepted (GTM gate). */
export function hasTrackingConsent(
  state: CookieConsentState | null = readCookieConsent(),
): boolean {
  return Boolean(
    state?.categories.analytics || state?.categories.marketing,
  )
}

export function openCookiePreferences() {
  if (typeof window === "undefined") return
  window.dispatchEvent(new Event(OPEN_COOKIE_PREFERENCES_EVENT))
}
