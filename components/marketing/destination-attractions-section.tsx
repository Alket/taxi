import Image from "next/image"

import {
  MarketingContainer,
  MARKETING_SECTION_TITLE,
} from "@/components/marketing/marketing-container"
import type { DestinationAttraction } from "@/lib/page-content-shared"

export function DestinationAttractionsSection({
  heading,
  attractions,
}: {
  heading: string
  attractions: DestinationAttraction[]
}) {
  if (attractions.length === 0) return null

  return (
    <section className="bg-brand-page py-12 md:py-16">
      <MarketingContainer>
        <h2 className={MARKETING_SECTION_TITLE}>{heading}</h2>
        <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {attractions.map((attraction) => (
            <li
              key={attraction.id}
              className="group overflow-hidden rounded-3xl border border-border/80 bg-brand-surface shadow-2xs transition-all duration-300 hover:-translate-y-1 hover:border-brand-accent/30 hover:shadow-md"
            >
              {attraction.image ? (
                <div className="relative aspect-[16/10] overflow-hidden bg-muted">
                  <Image
                    src={attraction.image}
                    alt={attraction.imageAlt || attraction.title}
                    fill
                    sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                    className="object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                  />
                </div>
              ) : null}
              <div className="p-6 sm:p-7">
                {attraction.title ? (
                  <h3 className="font-brand text-xl font-black tracking-tight text-brand transition-colors duration-200 group-hover:text-brand-accent">
                    {attraction.title}
                  </h3>
                ) : null}
                {attraction.description ? (
                  <p className="mt-2 text-sm leading-relaxed text-brand/75 sm:text-base">
                    {attraction.description}
                  </p>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </MarketingContainer>
    </section>
  )
}
