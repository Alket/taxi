import Image from "next/image"
import Link from "next/link"

import type { Destination } from "@/lib/destinations"
import type { Locale } from "@/lib/i18n/locales"
import { localePath } from "@/lib/i18n/locales"
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
    <section aria-label="Related airport transfer routes">
      <h2 className={MARKETING_SECTION_TITLE}>Related transfer routes</h2>
      <p className="mt-2 max-w-2xl text-base text-muted-foreground">
        Explore fixed-price private transfers from Tirana Airport to popular
        destinations.
      </p>
      <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {destinations.map((destination) => (
          <li key={destination.id}>
            <Link
              href={localePath(`/destinations/${destination.slug}`, locale)}
              className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-brand-surface transition-shadow hover:shadow-md"
            >
              <div className="relative aspect-[16/10] overflow-hidden bg-muted">
                <Image
                  src={destination.image}
                  alt={
                    destination.imageAlt ||
                    `${destination.name} airport transfer`
                  }
                  width={800}
                  height={500}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  sizes="(max-width: 640px) 100vw, 33vw"
                />
              </div>
              <div className="flex flex-1 flex-col gap-1 p-4">
                <p className="text-xs font-bold tracking-wide text-brand-accent uppercase">
                  From {destination.priceFrom}
                </p>
                <h3 className="font-brand text-lg font-extrabold text-brand">
                  {destination.primaryKeyword || destination.name}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {destination.travelTime} · {destination.region}
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
