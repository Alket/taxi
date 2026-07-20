/**
 * Runtime brand tokens for non-CSS contexts (e.g. Stripe appearance).
 * Prefer CSS variables / Tailwind `brand-*` classes in components.
 */
export const BRAND = {
  ink: "var(--brand-ink)",
  panel: "var(--brand-panel)",
  accent: "var(--brand-accent)",
  accentHover: "var(--brand-accent-hover)",
  page: "var(--brand-page)",
  surface: "var(--brand-surface)",
} as const

/** Resolve a CSS custom property to a concrete color for third-party SDKs. */
export function readBrandColor(
  property: "--brand-ink" | "--brand-accent" | "--brand-panel" | "--brand-page" | "--brand-surface" | "--brand-accent-hover",
  fallback: string,
): string {
  if (typeof window === "undefined") return fallback
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(property)
    .trim()
  return value || fallback
}

/** Resolve any CSS custom property at runtime (colors, radius, etc.). */
export function readCssVar(
  property: string,
  fallback: string,
  scope?: Element | null,
): string {
  if (typeof window === "undefined") return fallback
  const target = scope ?? document.documentElement
  const value = getComputedStyle(target).getPropertyValue(property).trim()
  return value || fallback
}
