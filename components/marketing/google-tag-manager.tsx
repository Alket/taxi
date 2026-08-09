"use client"

import Script from "next/script"
import { usePathname } from "next/navigation"
import { useEffect, useRef, useSyncExternalStore } from "react"

import {
  COOKIE_CONSENT_EVENT,
  getCookieConsentSnapshot,
  hasTrackingConsent,
} from "@/lib/cookie-consent"

const GTM_ID_RE = /^GTM-[A-Z0-9]+$/i

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

/**
 * Official Google Tag Manager snippets driven by Admin → Settings → Tracking.
 * Loads only after analytics or marketing cookie consent, and never on
 * /admin or /driver.
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
  const allowed = hasTrackingConsent(consent)
  const staff = isStaffPath(pathname)
  const shouldLoad = Boolean(id && allowed && !staff)
  const wasLoadedRef = useRef(false)

  // If the visitor withdraws tracking consent after GTM already ran, reload so
  // previously injected Google scripts are dropped from the session.
  useEffect(() => {
    if (wasLoadedRef.current && !shouldLoad && id && !staff) {
      window.location.reload()
      return
    }
    if (shouldLoad) wasLoadedRef.current = true
  }, [shouldLoad, id, staff])

  if (!shouldLoad || !id) return null

  return (
    <>
      <Script id="google-tag-manager" strategy="afterInteractive">{`
        (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
        new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
        j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
        'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
        })(window,document,'script','dataLayer','${id}');
      `}</Script>
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
