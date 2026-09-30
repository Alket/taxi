import Link from "next/link"

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
      className="my-10 rounded-3xl border border-brand-accent/30 bg-brand-page px-5 py-6 sm:px-7 sm:py-8"
    >
      <p className="text-xs font-bold tracking-[0.14em] text-brand-accent uppercase">
        {eyebrow}
      </p>
      <p className="mt-2 font-brand text-xl font-extrabold text-brand md:text-2xl">
        {heading}
      </p>
      <p className="mt-2 max-w-2xl text-base text-muted-foreground">{text}</p>
      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Link
          href={localePath(primaryHref, locale)}
          className="inline-flex min-h-11 items-center justify-center rounded-full bg-brand-accent !text-white px-6 text-sm font-extrabold transition-colors hover:bg-brand-accent-hover"
        >
          {primaryLabel}
        </Link>
        <Link
          href={localePath(secondaryHref, locale)}
          className="inline-flex min-h-11 items-center justify-center rounded-full border border-border bg-brand-surface px-6 text-sm font-extrabold text-brand transition-colors hover:bg-muted"
        >
          {secondaryLabel}
        </Link>
      </div>
    </aside>
  )
}
