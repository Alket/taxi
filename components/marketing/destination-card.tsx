"use client"

import Image from "next/image"
import Link from "next/link"
import { ArrowRight, ClockIcon, MapPinIcon, PlaneIcon } from "lucide-react"

import type { Destination } from "@/lib/destinations"
import { useLocale } from "@/lib/i18n/use-locale"
import { localePath } from "@/lib/i18n/locales"
import { t } from "@/lib/i18n/t"
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
  const locale = useLocale()

  return (
    <Link
      href={localePath(`/destinations/${destination.slug}`, locale)}
      className={cn(
        "group relative flex h-full w-full flex-col overflow-hidden rounded-3xl border border-border/80 bg-brand-surface shadow-xs",
        "transition-all duration-300 ease-out",
        "hover:-translate-y-1.5 hover:border-brand-accent/40 hover:shadow-[0_20px_40px_-15px_rgba(29,158,117,0.18)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:ring-offset-2",
        className,
      )}
    >
      {/* Top Half: Bright Un-Darkened Coastal/Destination Photo */}
      <div className="relative aspect-[16/10] w-full shrink-0 overflow-hidden bg-muted">
        <Image
          src={destination.image}
          alt={destination.imageAlt || destination.name}
          fill
          priority={priority}
          fetchPriority={priority ? "high" : "auto"}
          sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
          className="object-cover transition-transform duration-700 ease-out [@media(hover:hover)]:group-hover:scale-105"
        />
        {/* Subtle top-edge protection only so photo stays bright and vibrant */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/35 via-black/10 to-transparent" />

        <div className="relative z-10 flex items-start justify-between gap-2 p-4">
          {destination.badge ? (
            <span className="rounded-full border border-white/50 bg-white/95 px-3 py-1 text-[11px] font-extrabold tracking-wider text-brand uppercase shadow-xs backdrop-blur-md">
              {destination.badge}
            </span>
          ) : (
            <span />
          )}

          {destination.travelTime ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-brand-panel/80 px-3 py-1 text-xs font-bold text-white shadow-xs backdrop-blur-md">
              <ClockIcon className="size-3.5 shrink-0 text-emerald-300" aria-hidden />
              <span>{destination.travelTime}</span>
            </span>
          ) : null}
        </div>
      </div>

      {/* Bottom Half: Editorial Boarding-Pass Ticket Surface */}
      <div className="flex flex-1 flex-col p-5 sm:p-6">
        {/* Route Strip: TIA -> Destination Region */}
        <div className="flex items-center gap-2 text-[11px] font-extrabold tracking-wider text-muted-foreground uppercase">
          <span className="inline-flex items-center gap-1 rounded-md bg-brand-accent/10 px-2 py-0.5 text-brand-accent">
            <PlaneIcon className="size-3" aria-hidden />
            <span>TIA</span>
          </span>
          <span
            className="h-px flex-1 border-t border-dashed border-border"
            aria-hidden
          />
          <span className="inline-flex items-center gap-1 truncate text-brand/70">
            <MapPinIcon className="size-3 shrink-0 text-brand-accent" aria-hidden />
            <span className="truncate">
              {destination.primaryKeyword || destination.region}
            </span>
          </span>
        </div>

        {/* Title */}
        <h3 className="mt-3 font-brand text-2xl font-black tracking-tight text-brand transition-colors duration-200 group-hover:text-brand-accent">
          {destination.name}
        </h3>

        {/* Description */}
        <p className="mt-2 line-clamp-2 flex-1 text-sm leading-relaxed text-brand/75">
          {destination.description}
        </p>

        {/* Perforated Boarding-Pass Footer */}
        <div className="relative -mx-5 mt-5 flex items-center justify-between gap-3 border-t border-dashed border-border/90 px-5 pt-4 sm:-mx-6 sm:px-6">
          {/* Left & Right Ticket Notch Cutouts */}
          <span
            aria-hidden
            className="pointer-events-none absolute -top-2 -left-2 size-4 rounded-full border border-border/80 bg-brand-page"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute -top-2 -right-2 size-4 rounded-full border border-border/80 bg-brand-page"
          />

          <span className="font-mono text-base font-black tracking-tight text-brand sm:text-lg">
            {t(locale, "cta.from", { price: destination.priceFrom })}
          </span>

          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-accent/10 px-3.5 py-1.5 text-xs font-extrabold text-brand-accent transition-all duration-200 group-hover:bg-brand-accent group-hover:text-white group-hover:shadow-xs">
            <span>{t(locale, "cta.bookTransfer")}</span>
            <ArrowRight
              className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5"
              aria-hidden
            />
          </span>
        </div>
      </div>
    </Link>
  )
}
