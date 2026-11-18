import Image from "next/image"
import Link from "next/link"
import { ArrowRightIcon } from "lucide-react"

import type { Destination } from "@/lib/destinations"
import type { Locale } from "@/lib/i18n/locales"
import { localePath } from "@/lib/i18n/locales"
import { t } from "@/lib/i18n/t"
import { transferLinkForDestination } from "@/lib/transfers/routes"
import { MARKETING_SECTION_TITLE } from "@/components/marketing/marketing-container"

export function BlogRelatedRoutes({
  destinations,
  locale,
}: {
  destinations: Destination[]
  locale: Locale
}) {
  if (destinations.length === 0) return null

  return (
    <section aria-label={t(locale, "blog.relatedTitle")}>
      <h2 className={MARKETING_SECTION_TITLE}>
        {t(locale, "blog.relatedTitle")}
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-brand/75 sm:text-base">
        {t(locale, "blog.relatedText")}
      </p>
      <ul className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {destinations.map((destination) => {
          const transfer = transferLinkForDestination(destination.id)
          const href = transfer
            ? localePath(`/transfers/${transfer.transferSlug}`, locale)
            : localePath(`/destinations/${destination.slug}`, locale)
          const title = `Book a private transfer from Tirana Airport to ${destination.name}`

          return (
            <li key={destination.id}>
              <Link
                href={href}
                className="group flex h-full flex-col overflow-hidden rounded-3xl border border-border/80 bg-brand-surface shadow-2xs transition-all duration-300 hover:-translate-y-1 hover:border-brand-accent/30 hover:shadow-md"
              >
                <div className="relative aspect-[16/10] overflow-hidden bg-muted">
                  <Image
                    src={destination.image}
                    alt={
                      destination.imageAlt ||
                      `Private transfer from Tirana Airport to ${destination.name}`
                    }
                    width={800}
                    height={500}
                    className="size-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                    sizes="(max-width: 640px) 100vw, 33vw"
                  />
                  <span className="absolute top-3 left-3 rounded-full border border-white/20 bg-brand-surface/95 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-brand-accent shadow-xs backdrop-blur-sm">
                    {t(locale, "cta.from", { price: destination.priceFrom })}
                  </span>
                </div>
                <div className="flex flex-1 flex-col justify-between gap-3 p-5 sm:p-6">
                  <div>
                    <h3 className="font-brand text-base font-black leading-snug tracking-tight text-brand transition-colors duration-200 group-hover:text-brand-accent sm:text-lg">
                      {title}
                    </h3>
                  </div>
                  <div className="flex items-center justify-between border-t border-border/50 pt-3">
                    <p className="text-xs font-semibold text-muted-foreground">
                      {destination.travelTime} · {destination.region}
                    </p>
                    <span className="inline-flex size-7 items-center justify-center rounded-full bg-brand-accent/10 text-brand-accent transition-all duration-200 group-hover:translate-x-0.5 group-hover:bg-brand-accent group-hover:text-white">
                      <ArrowRightIcon className="size-3.5" aria-hidden />
                    </span>
                  </div>
                </div>
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
