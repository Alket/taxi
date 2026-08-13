"use client"

import Image from "next/image"
import {
  ArrowRightIcon,
  CircleCheckIcon,
  PlaneIcon,
  ShieldIcon,
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

const FEATURE_ICONS: LucideIcon[] = [ShieldIcon, CircleCheckIcon]

function emphasizeBrand(text: string) {
  const parts = text.split(/(Landed Albania)/g)
  return parts.map((part, index) =>
    part === "Landed Albania" ? (
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
      <span className="font-extrabold text-brand-accent">{phrase}</span>
      {heading.slice(index + phrase.length)}
    </>
  )
}

export function UberAltSection({ copy }: { copy: UberAltCopy }) {
  if (!copy.heading && !copy.text) return null

  const description = copy.text.split(/\n\s*\n/)[0]?.trim() ?? ""

  return (
    <section
      id="uber-alternative"
      aria-labelledby="uber-alt-heading"
      className="border-b border-border bg-brand-page py-10 font-uber-poppins md:py-20"
    >
      <MarketingContainer>
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-12">
          <div>
            {copy.eyebrow ? (
              <span className="mb-5 inline-flex items-center gap-2 rounded-full bg-accent px-3.5 py-1.5 text-[13px] font-extrabold tracking-wide text-brand-accent uppercase">
                <span
                  className="size-2 shrink-0 rounded-full bg-brand-accent motion-safe:animate-pulse"
                  aria-hidden
                />
                {copy.eyebrow}
              </span>
            ) : null}

            <h2
              id="uber-alt-heading"
              className={cn(
                MARKETING_SECTION_TITLE,
                "mb-5 !leading-[1.3] font-uber-poppins font-normal text-balance",
              )}
            >
              {headingWithHighlight(copy.heading, copy.highlight)}
            </h2>

            {description ? (
              <p className="mb-8 max-w-xl text-base leading-relaxed text-muted-foreground">
                {emphasizeBrand(description)}
              </p>
            ) : null}

            {copy.features.length > 0 ? (
              <div className="mb-9 grid grid-cols-1 gap-4 sm:grid-cols-2">
                {copy.features.map((feature, index) => {
                  const Icon = FEATURE_ICONS[index % FEATURE_ICONS.length]
                  return (
                    <div
                      key={`${feature.title}-${index}`}
                      className="flex items-center gap-3 rounded-xl border border-border bg-brand-surface px-[18px] py-3.5 shadow-[0_2px_4px_rgba(0,0,0,0.02)]"
                    >
                      <Icon
                        className="size-6 shrink-0 text-brand-accent"
                        strokeWidth={2}
                        aria-hidden
                      />
                      <div className="min-w-0">
                        <h3 className="m-0 text-[0.95rem] font-extrabold text-brand">
                          {feature.title}
                        </h3>
                        <p className="m-0 mt-0.5 text-[0.8rem] text-muted-foreground">
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
                    "group inline-flex items-center gap-2.5 rounded-full bg-brand-accent px-8 py-4 text-base font-extrabold text-white",
                    "shadow-[0_4px_14px_color-mix(in_srgb,var(--brand-accent)_35%,transparent)]",
                    "transition-all duration-200",
                    "hover:-translate-y-0.5 hover:bg-brand-accent-hover",
                    "hover:shadow-[0_6px_20px_color-mix(in_srgb,var(--brand-accent)_45%,transparent)]",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-page",
                  )}
                >
                  {copy.cta}
                  <ArrowRightIcon
                    className="size-[18px] transition-transform duration-200 group-hover:translate-x-1"
                    strokeWidth={2.5}
                    aria-hidden
                  />
                </button>
              </div>
            ) : null}
          </div>

          <div className="relative">
            <div className="group relative overflow-hidden rounded-3xl shadow-[0_20px_40px_rgba(0,0,0,0.08)]">
              <div className="relative aspect-[4/5] w-full sm:aspect-[5/6] lg:aspect-auto lg:h-[480px]">
                <Image
                  src={copy.image}
                  alt={copy.imageAlt || "Landed Albania premium airport transfer"}
                  fill
                  sizes="(min-width: 1024px) 40vw, 100vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                />
              </div>

              {copy.floatingBadge.title || copy.floatingBadge.text ? (
                <div className="absolute bottom-5 left-5 right-5 flex max-w-sm items-center gap-3 rounded-2xl border border-white/60 bg-brand-surface/85 px-5 py-3 shadow-[0_10px_30px_rgba(0,0,0,0.12)] backdrop-blur-md sm:right-auto">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-brand-accent">
                    <PlaneIcon className="size-5" strokeWidth={2} aria-hidden />
                  </span>
                  <div className="min-w-0">
                    {copy.floatingBadge.title ? (
                      <strong className="block text-[0.95rem] font-extrabold text-brand">
                        {copy.floatingBadge.title}
                      </strong>
                    ) : null}
                    {copy.floatingBadge.text ? (
                      <span className="block text-[0.8rem] text-muted-foreground">
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
