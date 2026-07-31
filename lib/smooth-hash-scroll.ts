import { localeFromPathname, localePath } from "@/lib/i18n/locales"

/** Extract id from `/#section`, `/it/#section`, or `#section`. */
export function getHashId(href: string): string | null {
  const hashIndex = href.indexOf("#")
  if (hashIndex < 0 || hashIndex === href.length - 1) return null
  return href.slice(hashIndex + 1) || null
}

export function scrollToHashId(
  id: string,
  options?: { updateUrl?: boolean },
): boolean {
  if (typeof document === "undefined") return false
  const el = document.getElementById(id)
  if (!el) return false

  const prefersReduced = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches

  el.scrollIntoView({
    behavior: prefersReduced ? "auto" : "smooth",
    block: "start",
  })

  if (options?.updateUrl !== false) {
    const locale = localeFromPathname(window.location.pathname)
    const next = localePath(`/#${id}`, locale)
    if (`${window.location.pathname}${window.location.hash}` !== next) {
      window.history.pushState(null, "", next)
    }
  }

  return true
}

/**
 * Smooth-scroll to an in-page hash when the target already exists.
 * Returns true if the default navigation was handled (caller should preventDefault).
 */
export function trySmoothHashNavigation(href: string): boolean {
  const id = getHashId(href)
  if (!id) return false
  return scrollToHashId(id)
}
