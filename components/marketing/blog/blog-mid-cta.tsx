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
      <Link
        href={localePath("/#book", locale)}
        className="mt-5 inline-flex min-h-11 items-center justify-center rounded-full bg-brand-accent !text-white px-6 text-sm font-extrabold transition-colors hover:bg-brand-accent-hover"
      >
        {t(locale, "blog.midCtaButton")}
      </Link>
    </aside>
  )
}
