import { Suspense } from "react"
import type { Metadata } from "next"

import { MyBookingView } from "@/components/booking/my-booking-view"
import { MarketingContainer } from "@/components/marketing/marketing-container"
import { Skeleton } from "@/components/ui/skeleton"
import { getRequestLocale } from "@/lib/i18n/get-locale"
import { localizedAlternates } from "@/lib/i18n/locales"
import { t } from "@/lib/i18n/t"
import { searchTitle } from "@/lib/seo/search-meta"

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale()
  const title = searchTitle(t(locale, "myBooking.title"))
  const description = t(locale, "myBooking.hero")

  return {
    title,
    description,
    alternates: localizedAlternates("/my-booking", locale),
    openGraph: {
      title: title.absolute,
      description,
    },
    twitter: {
      title: title.absolute,
      description,
    },
  }
}

function MyBookingFallback() {
  return (
    <div>
      <div className="-mt-24 h-[min(48svh,26rem)] min-h-[18rem] bg-brand-panel md:h-[min(44svh,30rem)]" />
      <MarketingContainer className="flex flex-col gap-6 py-10 md:py-14">
        <Skeleton className="h-64 w-full rounded-3xl" />
      </MarketingContainer>
    </div>
  )
}

export default function MyBookingPage() {
  return (
    <Suspense fallback={<MyBookingFallback />}>
      <MyBookingView />
    </Suspense>
  )
}
