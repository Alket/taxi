import Link from "next/link"

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
      className="rounded-3xl bg-brand-panel px-6 py-8 text-white sm:px-8 sm:py-10"
    >
      <div className="flex flex-col items-start gap-5 md:flex-row md:items-center md:justify-between md:gap-8">
        <div className="max-w-2xl">
          <p className="text-xs font-bold tracking-[0.14em] text-white/70 uppercase">
            {copy.eyebrow}
          </p>
          <h2 className="mt-2 font-brand text-2xl font-extrabold tracking-tight md:text-3xl">
            {copy.heading}
          </h2>
          <p className="mt-2 text-base leading-relaxed text-white/80">
            {copy.text}
          </p>
        </div>
        <Link
          href={localePath("/#book", locale)}
          className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-full bg-brand-accent px-7 text-sm font-extrabold text-white transition-colors hover:bg-brand-accent-hover"
        >
          {copy.button}
        </Link>
      </div>
    </aside>
  )
}
