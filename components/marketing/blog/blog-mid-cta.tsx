import Link from "next/link"

import type { Locale } from "@/lib/i18n/locales"
import { localePath } from "@/lib/i18n/locales"
import { t } from "@/lib/i18n/t"

export function BlogMidCta({ locale }: { locale: Locale }) {
  return (
    <aside
      aria-label={t(locale, "blog.midCtaHeading")}
      className="my-10 rounded-3xl border border-brand-accent/30 bg-brand-page px-5 py-6 sm:px-7 sm:py-8"
    >
      <p className="text-xs font-bold tracking-[0.14em] text-brand-accent uppercase">
        {t(locale, "blog.midCtaEyebrow")}
      </p>
      <p className="mt-2 font-brand text-xl font-extrabold text-brand md:text-2xl">
        {t(locale, "blog.midCtaHeading")}
      </p>
      <p className="mt-2 max-w-2xl text-base text-muted-foreground">
        {t(locale, "blog.midCtaText")}
      </p>
      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Link
          href={localePath("/transfers/tirana-airport-to-saranda", locale)}
          className="inline-flex min-h-11 items-center justify-center rounded-full bg-brand-accent !text-white px-6 text-sm font-extrabold transition-colors hover:bg-brand-accent-hover"
        >
          {t(locale, "blog.midCtaButton")}
        </Link>
        <Link
          href={localePath("/transfers/tirana-airport-to-ksamil", locale)}
          className="inline-flex min-h-11 items-center justify-center rounded-full border border-border bg-brand-surface px-6 text-sm font-extrabold text-brand transition-colors hover:bg-muted"
        >
          {t(locale, "blog.midCtaSecondary")}
        </Link>
      </div>
    </aside>
  )
}
