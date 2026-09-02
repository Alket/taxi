/**
 * Trustpilot TrustBox bootstrap (widgets). Distinct from invitejs.
 * Loaded in <head> so TrustBoxes on the page can render.
 */
export function TrustpilotWidgetBootstrap() {
  return (
    <script
      type="text/javascript"
      src="https://widget.trustpilot.com/bootstrap/v5/tp.widget.bootstrap.min.js"
      async
    />
  )
}
