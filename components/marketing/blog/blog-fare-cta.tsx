import Link from "next/link"
import { ArrowRightIcon } from "lucide-react"

import type { BlogArchiveCopy } from "@/lib/page-content-shared"
import type { Locale } from "@/lib/i18n/locales"
import { localePath } from "@/lib/i18n/locales"

export function BlogFareCta({
  locale,
  copy,
}: {
  locale: Locale
  copy: BlogArchiveCopy["cta"]
}) {
  return (
    <aside
      aria-label="Book a private transfer from Tirana Airport"
      className="overflow-hidden rounded-3xl border border-border bg-brand-surface"
    >
      <div className="flex flex-col gap-6 px-6 py-7 sm:px-8 sm:py-9 md:flex-row md:items-center md:justify-between md:gap-10">
        <div className="max-w-2xl">
          <p className="text-xs font-bold tracking-[0.14em] text-brand-accent uppercase">
            {copy.eyebrow}
          </p>
          <h2 className="mt-2 font-brand text-2xl font-extrabold tracking-tight text-brand md:text-3xl">
            {copy.heading}
          </h2>
          <p className="mt-2 text-base leading-relaxed text-muted-foreground">
            {copy.text}
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-3">
          <Link
            href={localePath("/transfers/tirana-airport-to-saranda", locale)}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-brand-accent px-7 text-sm font-extrabold text-white transition-colors hover:bg-brand-accent-hover"
          >
            Book a private transfer from Tirana Airport to Sarandë
            <ArrowRightIcon className="size-4" aria-hidden />
          </Link>
          <Link
            href={localePath("/#book", locale)}
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-border px-6 text-sm font-extrabold text-brand transition-colors hover:bg-muted"
          >
            {copy.button}
          </Link>
        </div>
      </div>
      <div
        className="h-1.5 w-full bg-[color-mix(in_srgb,var(--brand-accent)_35%,transparent)]"
        aria-hidden
      />
    </aside>
  )
}
