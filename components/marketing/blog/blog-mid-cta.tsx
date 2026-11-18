import Link from "next/link"
import { ArrowRightIcon } from "lucide-react"

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
      className="my-10 rounded-3xl border border-border/80 bg-brand-surface p-6 shadow-xs sm:p-8"
    >
      <p className="text-xs font-extrabold tracking-[0.14em] text-brand-accent uppercase">
        {eyebrow}
      </p>
      <p className="mt-2 font-brand text-xl font-extrabold text-brand sm:text-2xl">
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
          <ArrowRightIcon
            className="size-4 transition-transform duration-200 group-hover:translate-x-1"
            aria-hidden
          />
        </Link>
        <Link
          href={localePath(secondaryHref, locale)}
          className="inline-flex min-h-12 items-center justify-center rounded-full border border-border/80 bg-brand-surface px-6 text-sm font-bold text-brand shadow-2xs transition-all duration-200 hover:-translate-y-0.5 hover:bg-muted active:scale-[0.98]"
        >
          {secondaryLabel}
        </Link>
      </div>
    </aside>
  )
}
