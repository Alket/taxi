import Link from "next/link"

import type { Locale } from "@/lib/i18n/locales"
import { localePath } from "@/lib/i18n/locales"

export function BlogMidCta({ locale }: { locale: Locale }) {
  return (
    <aside
      aria-label="Reserve your Tirana Airport driver"
      className="my-10 rounded-3xl border border-brand-accent/30 bg-brand-page px-5 py-6 sm:px-7 sm:py-8"
    >
      <p className="text-xs font-bold tracking-[0.14em] text-brand-accent uppercase">
        Landing at Tirana Airport soon?
      </p>
      <p className="mt-2 font-brand text-xl font-extrabold text-brand md:text-2xl">
        Reserve your driver now—pay cash on arrival with €0 deposit
      </p>
      <p className="mt-2 max-w-2xl text-base text-muted-foreground">
        Fixed pricing from TIA to cities and the Riviera. Meet & greet included.
      </p>
      <Link
        href={localePath("/#book", locale)}
        className="mt-5 inline-flex min-h-11 items-center justify-center rounded-full bg-brand-accent px-6 text-sm font-extrabold text-white transition-colors hover:bg-brand-accent-hover"
      >
        Book my transfer
      </Link>
    </aside>
  )
}
