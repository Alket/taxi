"use client"

import * as React from "react"
import {
  ClockIcon,
  StarIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react"

import { cn } from "@/lib/utils"

const BENEFITS: {
  icon: LucideIcon
  title: string
  description: string
}[] = [
  {
    icon: UsersIcon,
    title: "Travellers rate us excellent",
    description: "4.98 / 5 average · 3000 reviews",
  },
  {
    icon: StarIcon,
    title: "Best drivers in Tirana",
    description: "We handpick the friendliest professional drivers",
  },
  {
    icon: ClockIcon,
    title: "Always on time",
    description: "Our drivers monitor the flights in case of delays",
  },
]

function BenefitCard({
  icon: Icon,
  title,
  description,
  className,
}: {
  icon: LucideIcon
  title: string
  description: string
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl px-4 py-3.5",
        className,
      )}
      style={{
        backgroundColor:
          "color-mix(in srgb, var(--brand-accent) 14%, white)",
        color: "var(--brand-ink)",
        fontFamily: "var(--font-brand)",
      }}
    >
      <Icon
        className="size-6 shrink-0"
        style={{ color: "var(--brand-ink)" }}
        strokeWidth={1.75}
      />
      <p className="min-w-0 text-[13px] leading-snug">
        <span className="font-bold">{title}</span>{" "}
        <span className="font-medium opacity-80">{description}</span>
      </p>
    </div>
  )
}

export function BookingHeaderBenefits() {
  const scrollerRef = React.useRef<HTMLDivElement>(null)
  const [active, setActive] = React.useState(0)

  function onScroll() {
    const el = scrollerRef.current
    if (!el) return
    const width = el.clientWidth
    if (width <= 0) return
    const next = Math.round(el.scrollLeft / width)
    setActive(Math.min(BENEFITS.length - 1, Math.max(0, next)))
  }

  function goTo(index: number) {
    const el = scrollerRef.current
    if (!el) return
    el.scrollTo({ left: index * el.clientWidth, behavior: "smooth" })
    setActive(index)
  }

  return (
    <div className="font-brand" style={{ fontFamily: "var(--font-brand)" }}>
      {/* Mobile slider */}
      <div className="sm:hidden">
        <div
          ref={scrollerRef}
          onScroll={onScroll}
          className="flex snap-x snap-mandatory overflow-x-auto scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {BENEFITS.map((benefit) => (
            <div
              key={benefit.title}
              className="w-full shrink-0 snap-center px-0"
            >
              <BenefitCard {...benefit} />
            </div>
          ))}
        </div>

        <div className="mt-3 flex items-center justify-center gap-1.5">
          {BENEFITS.map((benefit, index) => {
            const isActive = index === active
            return (
              <button
                key={benefit.title}
                type="button"
                aria-label={`Show benefit ${index + 1}`}
                aria-current={isActive ? "true" : undefined}
                onClick={() => goTo(index)}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300 touch-manipulation",
                  isActive ? "w-5" : "w-1.5",
                )}
                style={{
                  backgroundColor: isActive
                    ? "var(--brand-accent)"
                    : "var(--brand-ink)",
                  opacity: isActive ? 1 : 0.35,
                }}
              />
            )
          })}
        </div>
      </div>

      {/* Desktop / tablet grid */}
      <div className="hidden rounded-xl bg-brand-panel p-4 text-white sm:block md:p-6 lg:rounded-2xl">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3 md:gap-8">
          {BENEFITS.map(({ icon: Icon, title, description }) => (
            <div key={title} className="flex items-center gap-2">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-surface/10 sm:size-12">
                <Icon className="size-5 text-brand-accent sm:size-6" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold leading-tight sm:text-[13px]">
                  {title}
                </p>
                <p className="mt-0.5 text-[10px] text-white/60 sm:text-xs">
                  {description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
