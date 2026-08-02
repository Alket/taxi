import { CookieConsentBanner } from "@/components/marketing/cookie-consent-banner"
import { SiteFooter } from "@/components/marketing/site-footer"
import { SiteHeader } from "@/components/marketing/site-header"

export default async function BookingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="brand-frontend flex min-h-svh flex-col bg-brand-page font-brand text-brand">
      <SiteHeader className="pt-4" />
      <div className="flex-1">{children}</div>
      <SiteFooter />
      <CookieConsentBanner />
    </div>
  )
}
