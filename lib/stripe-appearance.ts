import type { Appearance } from "@stripe/stripe-js"

import { readBrandColor } from "@/lib/brand"

/** Google Fonts CSS — Stripe iframes cannot use Next.js CSS variables. */
export const STRIPE_BRAND_FONTS = [
  {
    cssSrc:
      "https://fonts.googleapis.com/css2?family=Mulish:wght@500;600;700;800&display=swap",
  },
] as const

/** Simple appearance for the public /book payment step. */
export function buildBookingStripeAppearance(): Appearance {
  const ink = readBrandColor("--brand-ink", "#2d3b4e")
  const accent = readBrandColor("--brand-accent", "#00cf95")
  const surface = readBrandColor("--brand-surface", "#ffffff")
  const border = "#e2e6eb"
  const muted = "#6b7585"

  return {
    theme: "stripe",
    labels: "above",
    variables: {
      colorPrimary: accent,
      colorBackground: surface,
      colorText: ink,
      colorTextSecondary: muted,
      colorTextPlaceholder: muted,
      colorDanger: "#e11d48",
      fontFamily:
        'Mulish, "Museo Sans", ui-sans-serif, system-ui, sans-serif',
      fontSizeBase: "16px",
      fontWeightNormal: "600",
      fontWeightMedium: "700",
      fontWeightBold: "800",
      borderRadius: "10px",
      spacingUnit: "4px",
    },
    rules: {
      ".Label": {
        fontSize: "13px",
        fontWeight: "700",
        color: ink,
        marginBottom: "6px",
      },
      ".Input": {
        backgroundColor: surface,
        border: `1px solid ${border}`,
        boxShadow: "none",
        padding: "12px",
        minHeight: "48px",
        fontSize: "16px",
        fontWeight: "600",
        color: ink,
      },
      ".Input:focus": {
        border: `1px solid ${accent}`,
        boxShadow: "none",
        outline: "none",
      },
      ".Input--invalid": {
        border: "1px solid #e11d48",
        boxShadow: "none",
      },
      ".Error": {
        fontSize: "12px",
        fontWeight: "600",
        color: "#e11d48",
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
