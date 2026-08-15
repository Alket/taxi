import type { Locale } from "@/lib/i18n/locales"
import { t } from "@/lib/i18n/t"

export function BlogQuickTakeaway({
  text,
  locale,
}: {
  text: string
  locale: Locale
}) {
  return (
    <aside
      aria-label={t(locale, "blog.quickTakeaway")}
      className="rounded-2xl border border-brand-accent/25 bg-[color-mix(in_srgb,var(--brand-accent)_10%,white)] px-5 py-5 sm:px-6 sm:py-6"
    >
      <p className="text-xs font-bold tracking-[0.14em] text-brand-accent uppercase">
        {t(locale, "blog.quickTakeaway")}
      </p>
      <p className="mt-2 text-base leading-relaxed font-medium text-brand md:text-lg">
        {text}
      </p>
    </aside>
  )
}
