"use client"

import useSWR from "swr"
import { StarIcon } from "lucide-react"

import {
  MarketingContainer,
  MARKETING_SECTION,
  MARKETING_SECTION_TITLE,
} from "@/components/marketing/marketing-container"
import { fetcher } from "@/lib/api"
import { cn } from "@/lib/utils"

type PublicReview = {
  id: string
  driverName: string
  driverRating: number
  platformRating: number
  comment: string | null
  customerFirstName: string
  routeLabel: string
  dropoffAddress: string
}

function Stars({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value} out of 5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <StarIcon
          key={i}
          className={cn(
            "size-3.5",
            i < Math.round(value)
              ? "fill-amber-400 text-amber-400"
              : "text-muted-foreground/30",
          )}
        />
      ))}
    </span>
  )
}

export function TestimonialsSection({
  destination,
}: {
  destination?: string
}) {
  const params = new URLSearchParams({ limit: "6" })
  if (destination) params.set("destination", destination)
  const { data } = useSWR<{ reviews: PublicReview[] }>(
    `/api/reviews/public?${params.toString()}`,
    fetcher,
  )
  const reviews = data?.reviews ?? []
  if (reviews.length === 0) return null

  return (
    <section className={cn(MARKETING_SECTION)}>
      <MarketingContainer>
        <div className="mb-10 max-w-2xl">
          <span className="mb-3 block text-xs font-extrabold tracking-widest text-primary uppercase">
            Traveller stories
          </span>
          <h2 className={MARKETING_SECTION_TITLE}>
            {destination
              ? `What guests say about ${destination}`
              : "Trusted by travellers across Albania"}
          </h2>
        </div>

        <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {reviews.map((review) => (
            <li
              key={review.id}
              className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6 shadow-sm"
            >
              <div className="flex items-center justify-between gap-2">
                <Stars value={review.platformRating} />
                <span className="text-xs text-muted-foreground">
                  Driver {review.driverRating.toFixed(1)}
                </span>
              </div>
              {review.comment ? (
                <p className="flex-1 text-sm leading-relaxed text-brand">
                  “{review.comment}”
                </p>
              ) : (
                <p className="flex-1 text-sm text-muted-foreground">
                  Rated {review.platformRating}/5 overall with{" "}
                  {review.driverName}.
                </p>
              )}
              <div className="border-t pt-3 text-xs text-muted-foreground">
                <p className="font-semibold text-brand">
                  {review.customerFirstName}
                </p>
                <p className="mt-0.5 truncate">
                  {review.driverName} · {review.dropoffAddress}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </MarketingContainer>
    </section>
  )
}
