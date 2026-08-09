"use client"

import Script from "next/script"
import { usePathname } from "next/navigation"
import { useEffect, useSyncExternalStore } from "react"

import {
  COOKIE_CONSENT_EVENT,
  getCookieConsentSnapshot,
  type CookieConsentState,
} from "@/lib/cookie-consent"

const GTM_ID_RE = /^GTM-[A-Z0-9]+$/i

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
  }
}

/** Normalize and validate a GTM container ID from settings. */
export function normalizeGtmContainerId(
  raw: string | null | undefined,
): string | null {
  const id = raw?.trim().toUpperCase() ?? ""
  if (!id || !GTM_ID_RE.test(id)) return null
  return id
}

function subscribeConsent(onStoreChange: () => void) {
  window.addEventListener(COOKIE_CONSENT_EVENT, onStoreChange)
  window.addEventListener("storage", onStoreChange)
  return () => {
    window.removeEventListener(COOKIE_CONSENT_EVENT, onStoreChange)
    window.removeEventListener("storage", onStoreChange)
  }
}

function isStaffPath(pathname: string) {
  const path = pathname.split("?")[0] || "/"
  return (
    path === "/admin" ||
    path.startsWith("/admin/") ||
    path === "/driver" ||
    path.startsWith("/driver/")
  )
}

function ensureGtag() {
  window.dataLayer = window.dataLayer || []
  if (typeof window.gtag !== "function") {
    window.gtag = function gtag() {
      // Google’s API expects the Arguments object, not a rest array.
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer?.push(arguments)
    }
  }
}

/** Map our cookie categories → Google Consent Mode v2. */
export function applyGoogleConsentUpdate(
  state: CookieConsentState | null,
) {
  if (typeof window === "undefined") return
  ensureGtag()
  const analytics = Boolean(state?.categories.analytics)
  const marketing = Boolean(state?.categories.marketing)
  window.gtag?.("consent", "update", {
    analytics_storage: analytics ? "granted" : "denied",
    ad_storage: marketing ? "granted" : "denied",
    ad_user_data: marketing ? "granted" : "denied",
    ad_personalization: marketing ? "granted" : "denied",
  })
}

/**
 * Google Tag Manager + Consent Mode v2.
 * - Script always loads on public pages when a container ID is set (so Google
 *   can detect the tag).
 * - Storage defaults to denied until Analytics/Marketing cookies are accepted.
 * - Never runs on /admin or /driver.
 */
export function GoogleTagManager({
  containerId,
}: {
  containerId: string | null | undefined
}) {
  const id = normalizeGtmContainerId(containerId)
  const pathname = usePathname() || "/"
  const consent = useSyncExternalStore(
    subscribeConsent,
    getCookieConsentSnapshot,
    () => null,
  )
  const staff = isStaffPath(pathname)

  useEffect(() => {
    if (!id || staff) return
    applyGoogleConsentUpdate(consent)
  }, [consent, id, staff])

  if (!id || staff) return null

  // Consent defaults MUST run before gtm.js. wait_for_update gives the client
  // a moment to read stored consent and call consent update.
  const bootstrap = `
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    window.gtag = gtag;
    gtag('consent', 'default', {
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      analytics_storage: 'denied',
      functionality_storage: 'granted',
      security_storage: 'granted',
      wait_for_update: 500
    });
    gtag('set', 'ads_data_redaction', true);
    (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
    new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
    j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
    'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
    })(window,document,'script','dataLayer','${id}');
  `

  return (
    <>
      <Script id="google-tag-manager" strategy="afterInteractive">
        {bootstrap}
      </Script>
      <noscript>
        <iframe
          src={`https://www.googletagmanager.com/ns.html?id=${id}`}
          height={0}
          width={0}
          style={{ display: "none", visibility: "hidden" }}
          title="Google Tag Manager"
        />
      </noscript>
    </>
  )
}
