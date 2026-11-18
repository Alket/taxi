import Link from "next/link"
import { ArrowRightIcon, SparklesIcon } from "lucide-react"

import type { BlogArchiveCopy } from "@/lib/page-content-shared"
import type { Locale } from "@/lib/i18n/locales"
import { localePath } from "@/lib/i18n/locales"
import { t } from "@/lib/i18n/t"

export function BlogFareCta({
  locale,
  copy,
}: {
  locale: Locale
  copy: BlogArchiveCopy["cta"]
}) {
  const primaryButtonLabel = t(locale, "blog.midCtaButton")

  return (
    <aside
      aria-label={copy.heading}
      className="overflow-hidden rounded-3xl border border-border/80 bg-brand-surface shadow-xs transition-shadow hover:shadow-sm"
    >
      <div className="flex flex-col gap-6 px-6 py-7 sm:px-8 sm:py-9 md:flex-row md:items-center md:justify-between md:gap-10">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-brand-accent/25 bg-brand-accent/10 px-3 py-0.5 text-xs font-black uppercase tracking-wider text-brand-accent">
            <SparklesIcon className="size-3" />
            <span>{copy.eyebrow}</span>
          </div>
          <h2 className="mt-3 font-brand text-2xl font-black tracking-tight text-brand md:text-3xl">
            {copy.heading}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-brand/75 sm:text-base">
            {copy.text}
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-3 sm:flex-row md:flex-col lg:flex-row">
          <Link
            href={localePath("/transfers/tirana-airport-to-saranda", locale)}
            className="group inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-brand-accent px-7 text-sm font-extrabold text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:brightness-95 active:scale-[0.98]"
          >
            <span>{primaryButtonLabel}</span>
            <ArrowRightIcon className="size-4 transition-transform duration-200 group-hover:translate-x-1" aria-hidden />
          </Link>
          <Link
            href={localePath("/#book", locale)}
            className="inline-flex min-h-12 items-center justify-center rounded-full border border-border/80 bg-brand-surface px-6 text-sm font-bold text-brand shadow-2xs transition-all duration-200 hover:-translate-y-0.5 hover:bg-muted active:scale-[0.98]"
          >
            {copy.button}
          </Link>
        </div>
      </div>
      <div
        className="h-1.5 w-full bg-gradient-to-r from-brand-accent/20 via-brand-accent to-brand-accent/20"
        aria-hidden
      />
    </aside>
  )
}
