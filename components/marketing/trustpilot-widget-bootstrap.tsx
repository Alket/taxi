import Script from "next/script"

/**
 * Trustpilot TrustBox bootstrap (widgets). Distinct from invitejs.
 * Deferred via lazyOnload so it does not compete with LCP on mobile.
 */
export function TrustpilotWidgetBootstrap() {
  return (
    <Script
      id="trustpilot-widget-bootstrap"
      src="https://widget.trustpilot.com/bootstrap/v5/tp.widget.bootstrap.min.js"
      strategy="lazyOnload"
    />
  )
}
