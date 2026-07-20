import type { Appearance } from "@stripe/stripe-js"

import { readBrandColor, readCssVar } from "@/lib/brand"

/** Google Fonts CSS — Stripe iframes cannot use Next.js CSS variables. */
export const STRIPE_BRAND_FONTS = [
  {
    cssSrc:
      "https://fonts.googleapis.com/css2?family=Mulish:wght@500;600;700;800&display=swap",
  },
] as const

const STRIPE_FONT_STACK =
  'Mulish, "Museo Sans", ui-sans-serif, system-ui, sans-serif'

/** Simple appearance for the public /book payment step. */
export function buildBookingStripeAppearance(): Appearance {
  const scope =
    typeof document !== "undefined"
      ? document.querySelector(".brand-frontend")
      : null

  const ink = readBrandColor("--brand-ink", "#2d3b4e")
  const accent = readBrandColor("--brand-accent", "#00cf95")
  const surface = readBrandColor("--brand-surface", "#ffffff")
  const page = readBrandColor("--brand-page", "#f5f5f5")
  const border = readCssVar("--border", "#e2e6eb", scope)
  const muted = readCssVar("--muted-foreground", "#6b7585", scope)
  const danger = readCssVar("--destructive", "#e11d48", scope)
  const radius = readCssVar("--radius-lg", "0.625rem", scope)

  return {
    theme: "stripe",
    labels: "above",
    variables: {
      colorPrimary: accent,
      colorBackground: page,
      colorText: ink,
      colorTextSecondary: muted,
      colorTextPlaceholder: muted,
      colorDanger: danger,
      fontFamily: STRIPE_FONT_STACK,
      fontSizeBase: "16px",
      fontWeightNormal: "500",
      fontWeightMedium: "600",
      fontWeightBold: "700",
      borderRadius: radius,
      spacingUnit: "4px",
      tabSpacing: "8px",
    },
    rules: {
      ".Tab": {
        backgroundColor: surface,
        border: `1px solid ${border}`,
        borderRadius: radius,
        boxShadow: "none",
        padding: "10px 14px",
        color: muted,
      },
      ".Tab:hover": {
        color: ink,
        borderColor: border,
      },
      ".Tab--selected": {
        backgroundColor: surface,
        border: `2px solid ${accent}`,
        boxShadow: "none",
        color: accent,
      },
      ".TabIcon--selected": {
        fill: accent,
        color: accent,
      },
      ".TabLabel--selected": {
        color: accent,
        fontWeight: "700",
      },
      ".Label": {
        fontSize: "14px",
        fontWeight: "600",
        color: ink,
        marginBottom: "6px",
      },
      ".Input": {
        backgroundColor: surface,
        border: `1px solid ${border}`,
        borderRadius: radius,
        boxShadow: "none",
        padding: "12px 14px",
        minHeight: "48px",
        fontSize: "16px",
        fontWeight: "500",
        color: ink,
      },
      ".Input:focus": {
        border: `1px solid ${accent}`,
        boxShadow: `0 0 0 1px ${accent}`,
        outline: "none",
      },
      ".Input--invalid": {
        border: `1px solid ${danger}`,
        boxShadow: "none",
      },
      ".Block": {
        backgroundColor: "transparent",
        border: "none",
        boxShadow: "none",
        padding: "0",
      },
      ".Error": {
        fontSize: "12px",
        fontWeight: "600",
        color: danger,
        marginTop: "4px",
      },
      ".AccordionItem": {
        border: "none",
        backgroundColor: "transparent",
        boxShadow: "none",
        padding: "0",
      },
    },
  }
}
