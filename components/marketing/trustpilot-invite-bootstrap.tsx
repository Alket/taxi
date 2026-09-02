/**
 * Trustpilot invitation bootstrap (invitejs).
 * Literal <script> in HTML (not next/script alone) so Trustpilot’s domain
 * verifier can find invitejs + tp('register', …) in View Source / fetch.
 * Load site-wide when the key is set (Trustpilot’s recommended placement).
 */
import { normalizeTrustpilotIntegrationKey } from "@/lib/trustpilot"

export function TrustpilotInviteBootstrap({
  integrationKey,
}: {
  integrationKey: string | null | undefined
}) {
  const key = normalizeTrustpilotIntegrationKey(integrationKey)
  if (!key) return null

  const register = `(function(w,d,s,r,n){w.TrustpilotObject=n;w[n]=w[n]||function(){(w[n].q=w[n].q||[]).push(arguments)};
var a=d.createElement(s);a.async=1;a.src=r;a.type='text/java'+s;var f=d.getElementsByTagName(s)[0];
f.parentNode.insertBefore(a,f)})(window,document,'script','https://invitejs.trustpilot.com/tp.min.js','tp');
tp('register', ${JSON.stringify(key)});`

  return (
    <script
      id="trustpilot-invite-bootstrap"
      dangerouslySetInnerHTML={{ __html: register }}
    />
  )
}
