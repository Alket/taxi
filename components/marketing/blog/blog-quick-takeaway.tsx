import type { Locale } from "@/lib/i18n/locales"
import { t } from "@/lib/i18n/t"

export function BlogQuickTakeaway({
  text,
  locale,
}: {
  text: string
  locale: Locale
}) {
  const body = text.trim()
  if (!body) return null

  return (
    <aside
      aria-label={t(locale, "blog.quickTakeaway")}
      className="rounded-2xl border border-border/80 border-l-4 border-l-brand-accent bg-brand-surface px-5 py-5 shadow-2xs sm:px-6 sm:py-6"
    >
      <p className="text-xs font-extrabold tracking-[0.14em] text-brand-accent uppercase">
        {t(locale, "blog.quickTakeaway")}
      </p>
      <p className="mt-2 font-brand text-base font-medium leading-relaxed text-brand sm:text-lg">
        {body}
      </p>
    </aside>
  )
}
