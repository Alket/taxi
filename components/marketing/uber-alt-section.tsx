"use client"

import Image from "next/image"
import {
  ArrowRightIcon,
  CircleCheckIcon,
  ClockIcon,
  PlaneIcon,
  ShieldCheckIcon,
  type LucideIcon,
} from "lucide-react"

import {
  MarketingContainer,
  MARKETING_SECTION_TITLE,
} from "@/components/marketing/marketing-container"
import { scrollToHashId } from "@/lib/smooth-hash-scroll"
import { cn } from "@/lib/utils"

type UberAltFeature = {
  title: string
  description: string
}

type UberAltCopy = {
  eyebrow: string
  heading: string
  highlight: string
  text: string
  cta: string
  image: string
  imageAlt: string
  features: UberAltFeature[]
  floatingBadge: {
    title: string
    text: string
  }
}

function resolveFeatureIcon(title: string, index: number): LucideIcon {
  const lower = title.toLowerCase()
  if (
    lower.includes("flight") ||
    lower.includes("plane") ||
    lower.includes("airport")
  ) {
    return PlaneIcon
  }
  if (
    lower.includes("price") ||
    lower.includes("fare") ||
    lower.includes("cost") ||
    lower.includes("fixed")
  ) {
    return ShieldCheckIcon
  }
  if (
    lower.includes("time") ||
    lower.includes("speed") ||
    lower.includes("minute")
  ) {
    return ClockIcon
  }
  return index % 2 === 0 ? ShieldCheckIcon : CircleCheckIcon
}

function emphasizeBrand(text: string) {
  const parts = text.split(/(Landed Albania|Albania Transfers)/g)
  return parts.map((part, index) =>
    part === "Landed Albania" || part === "Albania Transfers" ? (
      <strong key={`brand-${index}`} className="font-extrabold text-brand">
        {part}
      </strong>
    ) : (
      <span key={`copy-${index}`}>{part}</span>
    ),
  )
}

function headingWithHighlight(heading: string, highlight: string) {
  const phrase = highlight.trim()
  if (!phrase) return heading
  const index = heading.indexOf(phrase)
  if (index < 0) return heading
  return (
    <>
      {heading.slice(0, index)}
      <span className="font-black text-brand-accent">{phrase}</span>
      {heading.slice(index + phrase.length)}
    </>
  )
}

export function UberAltSection({ copy }: { copy: UberAltCopy }) {
  if (!copy.heading && !copy.text) return null

  const paragraphs = copy.text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)

  return (
    <section
      id="uber-alternative"
      aria-labelledby="uber-alt-heading"
      className="scroll-mt-24 border-b border-border/60 bg-brand-surface py-14 font-brand md:py-20 lg:py-24"
    >
      <MarketingContainer>
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-[1.12fr_0.88fr] lg:gap-14">
          {/* Left Column: Copy, Feature Cards & CTA */}
          <div>
            {copy.eyebrow ? (
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-brand-accent/25 bg-brand-accent/10 px-3.5 py-1 text-xs font-extrabold tracking-wider text-brand-accent uppercase">
                <span
                  className="size-1.5 shrink-0 rounded-full bg-brand-accent motion-safe:animate-pulse"
                  aria-hidden
                />
                <span>{copy.eyebrow}</span>
              </div>
            ) : null}

            <h2
              id="uber-alt-heading"
              className={cn(MARKETING_SECTION_TITLE, "mb-5 text-balance")}
            >
              {headingWithHighlight(copy.heading, copy.highlight)}
            </h2>

            {paragraphs.length > 0 ? (
              <div className="mb-8 max-w-xl space-y-3 text-base leading-relaxed text-brand/80 dark:text-muted-foreground md:text-lg">
                {paragraphs.map((paragraph, i) => (
                  <p key={i}>{emphasizeBrand(paragraph)}</p>
                ))}
              </div>
            ) : null}

            {copy.features.length > 0 ? (
              <div className="mb-9 grid grid-cols-1 items-stretch gap-3.5 sm:grid-cols-2 sm:gap-4">
                {copy.features.map((feature, index) => {
                  const Icon = resolveFeatureIcon(feature.title, index)
                  return (
                    <div
                      key={`${feature.title}-${index}`}
                      className="group flex h-full items-start gap-3.5 rounded-2xl border border-border/80 bg-brand-page/60 p-4 shadow-2xs transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-accent/35 hover:bg-brand-surface hover:shadow-sm sm:p-5"
                    >
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-accent/10 text-brand-accent shadow-2xs transition-colors duration-200 group-hover:bg-brand-accent group-hover:text-white">
                        <Icon
                          className="size-5"
                          strokeWidth={2.2}
                          aria-hidden
                        />
                      </div>
                      <div className="min-w-0">
                        <h3 className="m-0 font-brand text-[0.95rem] font-extrabold leading-snug text-brand transition-colors duration-200 group-hover:text-brand-accent sm:text-base">
                          {feature.title}
                        </h3>
                        <p className="m-0 mt-1 text-xs leading-relaxed text-brand/75 md:text-sm">
                          {feature.description}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : null}

            {copy.cta ? (
              <div>
                <button
                  type="button"
                  onClick={() => scrollToHashId("book")}
                  className={cn(
                    "group inline-flex min-h-12 w-full items-center justify-center gap-2.5 rounded-full bg-brand-accent px-8 py-4 text-base font-extrabold text-white sm:w-auto",
                    "shadow-[0_4px_14px_color-mix(in_srgb,var(--brand-accent)_35%,transparent)]",
                    "transition-all duration-200 active:scale-[0.98]",
                    "hover:-translate-y-0.5 hover:bg-brand-accent-hover hover:brightness-95",
                    "hover:shadow-[0_6px_20px_color-mix(in_srgb,var(--brand-accent)_45%,transparent)]",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:ring-offset-2",
                  )}
                >
                  <span>{copy.cta}</span>
                  <ArrowRightIcon
                    className="size-[18px] transition-transform duration-200 group-hover:translate-x-1"
                    strokeWidth={2.5}
                    aria-hidden
                  />
                </button>
              </div>
            ) : null}
          </div>

          {/* Right Column: Framed Image + Floating Arrival Telemetry Badge */}
          <div className="relative">
            <div className="group relative overflow-hidden rounded-3xl border border-border/80 bg-muted shadow-[0_20px_45px_-12px_rgba(0,0,0,0.14)]">
              <div className="relative aspect-[4/5] w-full sm:aspect-[5/6] lg:aspect-auto lg:h-[520px]">
                <Image
                  src={copy.image}
                  alt={
                    copy.imageAlt ||
                    "Private airport transfer at Tirana International Airport"
                  }
                  fill
                  sizes="(min-width: 1024px) 40vw, 100vw"
                  className="object-cover transition-transform duration-700 ease-out [@media(hover:hover)]:group-hover:scale-105"
                />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-brand-panel/60 via-brand-panel/20 to-transparent" />
              </div>

              {copy.floatingBadge.title || copy.floatingBadge.text ? (
                <div className="absolute right-4 bottom-4 left-4 flex max-w-sm items-center gap-3.5 rounded-2xl border border-white/70 bg-brand-surface/95 px-4 py-3.5 shadow-[0_12px_32px_rgba(0,0,0,0.16)] backdrop-blur-md sm:right-auto sm:bottom-5 sm:left-5 sm:px-5">
                  <span className="relative flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-accent text-white shadow-xs">
                    <PlaneIcon
                      className="size-5"
                      strokeWidth={2.2}
                      aria-hidden
                    />
                    <span
                      aria-hidden
                      className="absolute -top-1 -right-1 size-2.5 rounded-full border-2 border-white bg-emerald-400"
                    />
                  </span>
                  <div className="min-w-0">
                    {copy.floatingBadge.title ? (
                      <strong className="block font-brand text-[0.95rem] font-extrabold leading-snug text-brand">
                        {copy.floatingBadge.title}
                      </strong>
                    ) : null}
                    {copy.floatingBadge.text ? (
                      <span className="mt-0.5 block text-xs font-medium text-brand/75 md:text-sm">
                        {copy.floatingBadge.text}
                      </span>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </MarketingContainer>
    </section>
  )
}
