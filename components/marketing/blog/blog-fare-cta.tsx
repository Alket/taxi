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
      aria-label="Book a Tirana Airport transfer"
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
        <Link
          href={localePath("/#book", locale)}
          className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-brand-accent px-7 text-sm font-extrabold text-white transition-colors hover:bg-brand-accent-hover"
        >
          {copy.button}
          <ArrowRightIcon className="size-4" aria-hidden />
        </Link>
      </div>
      <div
        className="h-1.5 w-full bg-[color-mix(in_srgb,var(--brand-accent)_35%,transparent)]"
        aria-hidden
      />
    </aside>
  )
}
