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
    <section className="bg-brand-page py-8 md:py-10">
      <MarketingContainer>
        <h2 className={MARKETING_SECTION_TITLE}>{heading}</h2>
        <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {attractions.map((attraction) => (
            <li
              key={attraction.id}
              className="overflow-hidden rounded-2xl border border-border bg-brand-surface shadow-sm"
            >
              {attraction.image ? (
                <div className="aspect-[4/3] overflow-hidden bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={attraction.image}
                    alt={attraction.imageAlt || attraction.title}
                    className="size-full object-cover"
                    loading="lazy"
                  />
                </div>
              ) : null}
              <div className="p-5">
                {attraction.title ? (
                  <h3 className="font-brand text-xl font-extrabold tracking-tight text-brand">
                    {attraction.title}
                  </h3>
                ) : null}
                {attraction.description ? (
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
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
