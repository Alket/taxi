import { CookieConsentBanner } from "@/components/marketing/cookie-consent-banner"
import { hasCookieConsentDecision } from "@/lib/cookie-consent-server"
import { MarketingPreloader } from "@/components/marketing/marketing-preloader"
import { SiteFooter } from "@/components/marketing/site-footer"
import { SiteHeader } from "@/components/marketing/site-header"

export default async function BookingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const initialConsent = await hasCookieConsentDecision()
  return (
    <div className="brand-frontend flex min-h-svh flex-col bg-brand-page font-brand text-brand">
      <MarketingPreloader scope="booking" />
      <SiteHeader className="pt-4" />
      {children}
      <SiteFooter />
      <CookieConsentBanner initialConsent={initialConsent} />
    </div>
  )
}
