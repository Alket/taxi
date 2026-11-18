import Link from "next/link"
import { ArrowRightIcon, SparklesIcon } from "lucide-react"

import type { BlogBlock } from "@/lib/blog/types"
import type { Locale } from "@/lib/i18n/locales"
import { localePath } from "@/lib/i18n/locales"
import { t } from "@/lib/i18n/t"

type MidCtaBlock = Extract<BlogBlock, { type: "mid_cta" }>

function safeSitePath(value: string | undefined, fallback: string): string {
  const raw = value?.trim() ?? ""
  if (
    raw.startsWith("/") &&
    !raw.startsWith("//") &&
    !raw.includes("://")
  ) {
    return raw
  }
  return fallback
}

export function BlogMidCta({
  locale,
  block,
}: {
  locale: Locale
  block?: MidCtaBlock | null
}) {
  const eyebrow =
    block?.eyebrow?.trim() || t(locale, "blog.midCtaEyebrow")
  const heading =
    block?.heading?.trim() || t(locale, "blog.midCtaHeading")
  const text = block?.text?.trim() || t(locale, "blog.midCtaText")
  const primaryLabel =
    block?.primaryLabel?.trim() || t(locale, "blog.midCtaButton")
  const secondaryLabel =
    block?.secondaryLabel?.trim() || t(locale, "blog.midCtaSecondary")
  const primaryHref = safeSitePath(
    block?.primaryHref,
    "/transfers/tirana-airport-to-saranda",
  )
  const secondaryHref = safeSitePath(
    block?.secondaryHref,
    "/transfers/tirana-airport-to-ksamil",
  )

  return (
    <aside
      aria-label={heading}
      className="relative my-10 overflow-hidden rounded-3xl border border-brand-accent/30 bg-brand-surface p-6 shadow-xs sm:p-8"
    >
      <div className="inline-flex items-center gap-1.5 rounded-full border border-brand-accent/25 bg-brand-accent/10 px-3 py-0.5 text-xs font-black uppercase tracking-wider text-brand-accent">
        <SparklesIcon className="size-3" />
        <span>{eyebrow}</span>
      </div>
      <p className="mt-3 font-brand text-xl font-black text-brand sm:text-2xl">
        {heading}
      </p>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-brand/75 sm:text-base">
        {text}
      </p>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Link
          href={localePath(primaryHref, locale)}
          className="group inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-brand-accent px-7 text-sm font-extrabold !text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:brightness-95 active:scale-[0.98]"
        >
          <span>{primaryLabel}</span>
          <ArrowRightIcon className="size-4 transition-transform duration-200 group-hover:translate-x-1" aria-hidden />
        </Link>
        <Link
          href={localePath(secondaryHref, locale)}
          className="inline-flex min-h-12 items-center justify-center rounded-full border border-border/80 bg-brand-surface px-6 text-sm font-bold text-brand shadow-2xs transition-all duration-200 hover:-translate-y-0.5 hover:bg-muted active:scale-[0.98]"
        >
          {secondaryLabel}
        </Link>
      </div>
      <div
        className="absolute top-0 left-0 h-1 w-full bg-gradient-to-r from-brand-accent via-brand-accent/80 to-transparent"
        aria-hidden
      />
    </aside>
  )
}
