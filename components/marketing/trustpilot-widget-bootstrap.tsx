"use client"

import Script from "next/script"
import { usePathname } from "next/navigation"

import { isTrustpilotStaffPath } from "@/lib/trustpilot"

/**
 * Trustpilot TrustBox bootstrap (widgets). Distinct from invitejs.
 * Deferred via lazyOnload so it does not compete with LCP on mobile,
 * and skipped entirely on /admin and /driver portals.
 */
export function TrustpilotWidgetBootstrap() {
  const pathname = usePathname() || "/"
  if (isTrustpilotStaffPath(pathname)) return null

  return (
    <Script
      id="trustpilot-widget-bootstrap"
      src="https://widget.trustpilot.com/bootstrap/v5/tp.widget.bootstrap.min.js"
      strategy="lazyOnload"
    />
  )
}
