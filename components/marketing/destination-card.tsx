"use client"

import Image from "next/image"
import Link from "next/link"
import { ArrowRight, ClockIcon } from "lucide-react"

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
        "hover:-translate-y-1 hover:border-border hover:shadow-lg",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:ring-offset-2",
        className,
      )}
    >
      {/* Top Half: Bright Un-Darkened Destination Photo */}
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
        <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/30 to-transparent" />

        <div className="relative z-10 flex items-start justify-between gap-2 p-4">
          {destination.badge ? (
            <span className="rounded-full bg-white/95 px-3 py-1 text-[11px] font-extrabold tracking-wide text-brand shadow-xs backdrop-blur-md">
              {destination.badge}
            </span>
          ) : (
            <span />
          )}

          {destination.travelTime ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-panel/80 px-3 py-1 text-xs font-bold text-white shadow-xs backdrop-blur-md">
              <ClockIcon className="size-3.5 shrink-0 text-white/85" aria-hidden />
              <span>{destination.travelTime}</span>
            </span>
          ) : null}
        </div>
      </div>

      {/* Bottom Half: Clean Editorial Surface */}
      <div className="flex flex-1 flex-col p-5 sm:p-6">
        {destination.primaryKeyword || destination.region ? (
          <p className="text-xs font-extrabold tracking-[0.12em] text-brand-accent uppercase">
            {destination.primaryKeyword || destination.region}
          </p>
        ) : null}

        <h3 className="mt-1.5 font-brand text-2xl font-extrabold tracking-tight text-brand transition-colors duration-200 group-hover:text-brand-accent">
          {destination.name}
        </h3>

        <p className="mt-2 line-clamp-2 flex-1 text-sm leading-relaxed text-brand/75">
          {destination.description}
        </p>

        <div className="mt-5 flex items-center justify-between gap-3 border-t border-border/70 pt-4">
          <span className="text-base font-extrabold tracking-tight text-brand sm:text-lg">
            {t(locale, "cta.from", { price: destination.priceFrom })}
          </span>

          <span className="inline-flex items-center gap-1.5 text-sm font-extrabold text-brand-accent transition-transform duration-200 group-hover:translate-x-0.5">
            <span>{t(locale, "cta.bookTransfer")}</span>
            <ArrowRight className="size-4" aria-hidden />
          </span>
        </div>
      </div>
    </Link>
  )
}
