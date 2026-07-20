import { SiteFooter } from "@/components/marketing/site-footer"
import { SiteHeader } from "@/components/marketing/site-header"

export default function BookingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="brand-frontend flex min-h-svh flex-col bg-brand-page font-brand text-brand">
      <div className="pt-4">
        <SiteHeader />
      </div>
      <div className="flex-1">{children}</div>
      <SiteFooter />
    </div>
  )
}
