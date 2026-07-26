import Link from "next/link"

import type { Destination } from "@/lib/destinations"
import { cn } from "@/lib/utils"

export function DestinationCard({
  destination,
  className,
  priority = false,
}: {
  destination: Destination
  className?: string
  priority?: boolean
}) {
  return (
    <Link
      href={`/destinations/${destination.id}`}
      className={cn(
        "group relative flex h-[380px] flex-col overflow-hidden rounded-2xl border border-border bg-muted shadow-sm transition-shadow duration-300 hover:shadow-xl sm:rounded-3xl md:h-[400px]",
        className,
      )}
    >
      <div className="absolute inset-0 bg-muted">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={destination.image}
          alt={destination.imageAlt || destination.name}
          className="size-full object-cover transition-transform duration-500 [@media(hover:hover)]:group-hover:scale-105"
          loading={priority ? "eager" : "lazy"}
          draggable={false}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-brand-panel/90 via-brand-panel/25 to-transparent" />
      </div>

      <div className="relative z-10 flex items-start justify-between gap-2 p-4 sm:p-6">
        <span className="rounded-full bg-card/90 px-2.5 py-1 text-[11px] font-extrabold text-brand backdrop-blur-md sm:px-3 sm:text-xs">
          {destination.badge}
        </span>
        <span className="rounded-full bg-primary px-2.5 py-1 text-[11px] font-extrabold text-primary-foreground sm:px-3 sm:text-xs">
          From {destination.priceFrom}
        </span>
      </div>

      <div className="relative z-10 mt-auto p-4 text-white sm:p-6">
        <h3 className="mb-1.5 text-2xl font-extrabold md:mb-2">
          {destination.name}
        </h3>
        <p className="line-clamp-2 text-sm leading-snug text-white/85">
          {destination.description}
        </p>
      </div>
    </Link>
  )
}
