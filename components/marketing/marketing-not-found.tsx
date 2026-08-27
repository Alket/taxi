import Link from "next/link"

import { SiteFooter } from "@/components/marketing/site-footer"
import { SiteHeader } from "@/components/marketing/site-header"
import { getRequestLocale } from "@/lib/i18n/get-locale"
import { DEFAULT_LOCALE, localePath, type Locale } from "@/lib/i18n/locales"
import { t } from "@/lib/i18n/t"

async function safeLocale(): Promise<Locale> {
  try {
    return await getRequestLocale()
  } catch {
    return DEFAULT_LOCALE
  }
}

/** Shared marketing 404 body (root + booking not-found). */
export async function MarketingNotFoundContent({
  withChrome = false,
}: {
  /** Root layout has no SiteHeader — wrap the brand shell when needed. */
  withChrome?: boolean
}) {
  const locale = await safeLocale()
  const homeHref = localePath("/", locale)
  const destinationsHref = localePath("/destinations", locale)
  const bookHref = localePath("/#book", locale)

  const inner = (
    <main className="relative flex flex-1 flex-col justify-center overflow-hidden px-4 py-20 md:py-28">
      {/* Soft atmosphere — keeps the page from feeling like a blank error dump */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,color-mix(in_srgb,var(--brand-accent)_14%,transparent),transparent_55%)]"
      />
      <div className="relative mx-auto w-full max-w-lg text-center">
        <p
          className="font-brand text-[clamp(4.5rem,18vw,7rem)] leading-none font-extrabold tracking-tight text-brand/[0.08] select-none"
          aria-hidden
        >
          404
        </p>
        <h1 className="font-brand -mt-6 text-2xl font-extrabold tracking-tight text-brand md:-mt-8 md:text-3xl">
          {t(locale, "notFound.title")}
        </h1>
        <p className="mx-auto mt-3 max-w-md text-[0.95rem] leading-relaxed text-brand/65 md:text-base">
          {t(locale, "notFound.body")}
        </p>
        <div className="mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:justify-center">
          <Link
            href={homeHref}
            className="inline-flex h-11 items-center justify-center rounded-xl bg-[var(--brand-accent)] px-6 text-sm font-semibold text-white transition hover:opacity-90"
          >
            {t(locale, "common.backHome")}
          </Link>
          <Link
            href={bookHref}
            className="inline-flex h-11 items-center justify-center rounded-xl border border-brand/15 bg-white px-6 text-sm font-semibold text-brand shadow-sm transition hover:bg-brand/[0.03]"
          >
            {t(locale, "cta.bookTransfer")}
          </Link>
        </div>
        <p className="mt-6 text-sm text-brand/50">
          <Link
            href={destinationsHref}
            className="underline-offset-4 hover:text-brand hover:underline"
          >
            {t(locale, "notFound.browseDestinations")}
          </Link>
        </p>
      </div>
    </main>
  )

  if (!withChrome) return inner

  return (
    <div className="brand-frontend flex min-h-svh flex-col bg-brand-page font-brand text-brand">
      <SiteHeader className="pt-4" />
      {inner}
      <SiteFooter />
    </div>
  )
}
