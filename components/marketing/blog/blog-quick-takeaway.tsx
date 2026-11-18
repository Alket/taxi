import { SparklesIcon } from "lucide-react"

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
      className="relative overflow-hidden rounded-3xl border border-brand-accent/30 bg-brand-surface p-6 shadow-xs sm:p-7"
    >
      <div className="flex items-center gap-2">
        <span className="flex size-7 items-center justify-center rounded-full bg-brand-accent/10 text-brand-accent">
          <SparklesIcon className="size-3.5" />
        </span>
        <p className="text-xs font-black uppercase tracking-wider text-brand-accent">
          {t(locale, "blog.quickTakeaway")}
        </p>
      </div>
      <p className="mt-3 font-brand text-base font-bold leading-relaxed text-brand sm:text-lg">
        {body}
      </p>
      <div
        className="absolute top-0 left-0 h-1 w-full bg-gradient-to-r from-brand-accent via-brand-accent/80 to-transparent"
        aria-hidden
      />
    </aside>
  )
}
