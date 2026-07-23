/** Extract id from `/#section` or `#section`. */
export function getHashId(href: string): string | null {
  if (href.startsWith("/#")) return href.slice(2) || null
  if (href.startsWith("#") && href.length > 1) return href.slice(1)
  return null
}

export function scrollToHashId(
  id: string,
  options?: { updateUrl?: boolean }
): boolean {
  if (typeof document === "undefined") return false
  const el = document.getElementById(id)
  if (!el) return false

  const prefersReduced = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches

  el.scrollIntoView({
    behavior: prefersReduced ? "auto" : "smooth",
    block: "start",
  })

  if (options?.updateUrl !== false) {
    const next = `/#${id}`
    if (window.location.hash !== `#${id}`) {
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
