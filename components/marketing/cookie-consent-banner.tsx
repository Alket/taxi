"use client"

import { useEffect, useState, useSyncExternalStore } from "react"
import Link from "next/link"

import { MarketingContainer } from "@/components/marketing/marketing-container"
import {
  COOKIE_CONSENT_EVENT,
  DEFAULT_ACCEPTED_CONSENT,
  DEFAULT_REJECTED_CONSENT,
  OPEN_COOKIE_PREFERENCES_EVENT,
  getCookieConsentSnapshot,
  openCookiePreferences,
  readCookieConsent,
  writeCookieConsent,
  type CookieConsentCategories,
} from "@/lib/cookie-consent"
import { localePath } from "@/lib/i18n/locales"
import { useLocale, useT } from "@/lib/i18n/use-locale"
import { cn } from "@/lib/utils"

export { openCookiePreferences }

function subscribeConsent(onStoreChange: () => void) {
  window.addEventListener(COOKIE_CONSENT_EVENT, onStoreChange)
  window.addEventListener("storage", onStoreChange)
  return () => {
    window.removeEventListener(COOKIE_CONSENT_EVENT, onStoreChange)
    window.removeEventListener("storage", onStoreChange)
  }
}

function CategoryToggle({
  id,
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  id: string
  label: string
  description: string
  checked: boolean
  disabled?: boolean
  onChange?: (next: boolean) => void
}) {
  return (
    <label
      htmlFor={id}
      className={cn(
        "flex cursor-pointer items-start justify-between gap-4 rounded-2xl border border-border bg-brand-page px-4 py-3",
        disabled && "cursor-default opacity-80",
      )}
    >
      <span className="min-w-0">
        <span className="block text-sm font-extrabold text-brand">{label}</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
          {description}
        </span>
      </span>
      <input
        id={id}
        type="checkbox"
        className="mt-1 size-4 shrink-0 accent-[var(--brand-accent)]"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.checked)}
      />
    </label>
  )
}

export function CookieConsentBanner() {
  const tr = useT()
  const locale = useLocale()
  const consent = useSyncExternalStore(
    subscribeConsent,
    getCookieConsentSnapshot,
    () => null,
  )
  const [forceOpen, setForceOpen] = useState(false)
  const [customize, setCustomize] = useState(false)
  const [categories, setCategories] = useState<CookieConsentCategories>(
    DEFAULT_REJECTED_CONSENT,
  )

  useEffect(() => {
    function onOpenPreferences() {
      const current = readCookieConsent()
      setCategories(current?.categories ?? DEFAULT_REJECTED_CONSENT)
      setCustomize(true)
      setForceOpen(true)
    }

    window.addEventListener(OPEN_COOKIE_PREFERENCES_EVENT, onOpenPreferences)
    return () => {
      window.removeEventListener(
        OPEN_COOKIE_PREFERENCES_EVENT,
        onOpenPreferences,
      )
    }
  }, [])

  useEffect(() => {
    if (consent) setCategories(consent.categories)
  }, [consent])

  const visible = forceOpen || !consent

  function save(next: CookieConsentCategories) {
    writeCookieConsent(next)
    setCategories(next)
    setCustomize(false)
    setForceOpen(false)
  }

  if (!visible) return null

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[100] pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2"
      role="dialog"
      aria-modal="false"
      aria-labelledby="cookie-consent-title"
      aria-describedby="cookie-consent-desc"
    >
      <MarketingContainer>
        <div className="rounded-3xl border border-border bg-brand-surface p-5 shadow-[0_-8px_40px_rgba(15,23,42,0.12)] sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between lg:gap-8">
            <div className="min-w-0 flex-1">
              <p
                id="cookie-consent-title"
                className="text-base font-extrabold tracking-tight text-brand"
              >
                {tr("cookies.bannerTitle")}
              </p>
              <p
                id="cookie-consent-desc"
                className="mt-1.5 text-sm leading-relaxed text-muted-foreground"
              >
                {tr("cookies.bannerBody")}{" "}
                <Link
                  href={localePath("/cookies", locale)}
                  className="font-semibold text-brand underline underline-offset-2"
                >
                  {tr("cookies.learnMore")}
                </Link>
              </p>

              {customize ? (
                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  <CategoryToggle
                    id="cookie-necessary"
                    label={tr("cookies.necessary")}
                    description={tr("cookies.necessaryDesc")}
                    checked
                    disabled
                  />
                  <CategoryToggle
                    id="cookie-analytics"
                    label={tr("cookies.analytics")}
                    description={tr("cookies.analyticsDesc")}
                    checked={categories.analytics}
                    onChange={(analytics) =>
                      setCategories((prev) => ({ ...prev, analytics }))
                    }
                  />
                  <CategoryToggle
                    id="cookie-marketing"
                    label={tr("cookies.marketing")}
                    description={tr("cookies.marketingDesc")}
                    checked={categories.marketing}
                    onChange={(marketing) =>
                      setCategories((prev) => ({ ...prev, marketing }))
                    }
                  />
                </div>
              ) : null}
            </div>

            <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:flex-wrap lg:flex-col xl:flex-row">
              <button
                type="button"
                className="inline-flex h-11 items-center justify-center rounded-full border border-border bg-brand-page px-5 text-sm font-bold text-brand transition-colors hover:bg-muted"
                onClick={() => save(DEFAULT_REJECTED_CONSENT)}
              >
                {tr("cookies.reject")}
              </button>
              <button
                type="button"
                className="inline-flex h-11 items-center justify-center rounded-full border border-border bg-brand-page px-5 text-sm font-bold text-brand transition-colors hover:bg-muted"
                onClick={() =>
                  customize
                    ? save({ ...categories, necessary: true })
                    : setCustomize(true)
                }
              >
                {customize ? tr("cookies.save") : tr("cookies.customize")}
              </button>
              <button
                type="button"
                className="inline-flex h-11 items-center justify-center rounded-full bg-brand-accent px-5 text-sm font-extrabold text-white transition-colors hover:bg-brand-accent-hover"
                onClick={() => save(DEFAULT_ACCEPTED_CONSENT)}
              >
                {tr("cookies.accept")}
              </button>
            </div>
          </div>
        </div>
      </MarketingContainer>
    </div>
  )
}
