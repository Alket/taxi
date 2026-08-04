import { MarketingPageEnter } from "@/components/marketing/marketing-page-enter"

/** Remounts on route change so marketing pages enter with a soft transition. */
export default function BookingTemplate({
  children,
}: {
  children: React.ReactNode
}) {
  return <MarketingPageEnter className="flex-1">{children}</MarketingPageEnter>
}
