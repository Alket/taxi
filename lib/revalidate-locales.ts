import { revalidatePath } from "next/cache"

import { LOCALES, localePath } from "@/lib/i18n/locales"

/**
 * Revalidate a public path across every locale variant (`/terms`, `/it/terms`,
 * `/de/terms`, …). Needed once pages use ISR (`revalidate`) instead of
 * `force-dynamic` — each localized URL is cached separately, so a CMS edit
 * must invalidate all of them, not just the default-locale path.
 */
export function revalidateAllLocales(path: string, type?: "layout" | "page") {
  for (const locale of LOCALES) {
    revalidatePath(localePath(path, locale), type)
  }
}
