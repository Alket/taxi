import type { Appearance } from "@stripe/stripe-js"

import { readBrandColor } from "@/lib/brand"

/** Google Fonts CSS — Stripe iframes cannot use Next.js CSS variables. */
export const STRIPE_BRAND_FONTS = [
  {
    cssSrc:
      "https://fonts.googleapis.com/css2?family=Mulish:wght@500;600;700;800&display=swap",
  },
] as const

/**
 * Appearance for the public /book payment step.
 * Mirrors `.brand-frontend` form styling (Mulish / Museo Sans, bold labels, h-12 inputs).
 */
export function buildBookingStripeAppearance(): Appearance {
  const ink = readBrandColor("--brand-ink", "#2d3b4e")
  const accent = readBrandColor("--brand-accent", "#00cf95")
  const surface = readBrandColor("--brand-surface", "#ffffff")
  const border = "#e2e6eb"
  const muted = "#6b7585"
  const mutedBg = "#eef1f4"
  const accentSoft = "rgba(0, 207, 149, 0.08)"

  return {
    theme: "stripe",
    labels: "above",
    inputs: "spaced",
    variables: {
      colorPrimary: accent,
      colorBackground: surface,
      colorText: ink,
      colorTextSecondary: muted,
      colorTextPlaceholder: muted,
      colorDanger: "#e11d48",
      colorIcon: muted,
      colorIconTab: muted,
      colorIconTabSelected: accent,
      colorIconCardError: "#e11d48",
      fontFamily:
        'Mulish, "Museo Sans", ui-sans-serif, system-ui, sans-serif',
      fontSizeBase: "16px",
      fontSizeSm: "14px",
      fontSizeXs: "12px",
      fontSizeLg: "16px",
      fontWeightLight: "500",
      fontWeightNormal: "700",
      fontWeightMedium: "700",
      fontWeightBold: "800",
      borderRadius: "8px",
      spacingUnit: "4px",
      gridColumnSpacing: "12px",
      gridRowSpacing: "16px",
      tabSpacing: "8px",
      accordionItemSpacing: "10px",
    },
    rules: {
      ".Label": {
        fontSize: "14px",
        fontWeight: "800",
        lineHeight: "1.25rem",
        color: ink,
        marginBottom: "8px",
        letterSpacing: "0",
        textTransform: "none",
      },
      ".Input": {
        backgroundColor: surface,
        border: `1px solid ${border}`,
        boxShadow: "none",
        padding: "14px 12px",
        minHeight: "48px",
        fontSize: "16px",
        fontWeight: "700",
        lineHeight: "1.25",
        color: ink,
        transition: "border-color 0.15s ease",
      },
      ".Input:hover": {
        border: `1px solid ${border}`,
        boxShadow: "none",
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
      ".Input--invalid:focus": {
        border: "1px solid #e11d48",
        boxShadow: "none",
      },
      ".Input::placeholder": {
        color: muted,
        fontWeight: "700",
      },
      ".Error": {
        fontSize: "12px",
        fontWeight: "700",
        color: "#e11d48",
        marginTop: "6px",
      },
      ".Tab": {
        border: `1px solid ${border}`,
        borderRadius: "8px",
        backgroundColor: surface,
        boxShadow: "none",
        padding: "12px 14px",
        fontWeight: "700",
        color: ink,
      },
      ".Tab:hover": {
        backgroundColor: mutedBg,
        boxShadow: "none",
      },
      ".Tab--selected, .Tab--selected:focus, .Tab--selected:hover": {
        borderColor: accent,
        backgroundColor: accentSoft,
        boxShadow: `0 0 0 1px ${accent}`,
        color: ink,
      },
      ".TabIcon": {
        fill: muted,
      },
      ".TabIcon--selected": {
        fill: accent,
      },
      ".TabLabel": {
        fontWeight: "700",
        fontSize: "14px",
      },
      ".AccordionItem": {
        border: `1px solid ${border}`,
        borderRadius: "8px",
        backgroundColor: surface,
        boxShadow: "none",
        padding: "4px",
      },
      ".AccordionItem--selected": {
        borderColor: accent,
        boxShadow: `0 0 0 1px ${accent}`,
      },
      ".Block": {
        backgroundColor: surface,
        borderRadius: "8px",
        boxShadow: "none",
      },
      ".CheckboxInput": {
        borderRadius: "4px",
        borderColor: border,
        backgroundColor: surface,
      },
      ".CheckboxInput--checked": {
        backgroundColor: accent,
        borderColor: accent,
      },
      ".CheckboxLabel": {
        fontWeight: "700",
        color: ink,
        fontSize: "14px",
      },
      ".PickerItem": {
        border: `1px solid ${border}`,
        borderRadius: "8px",
        backgroundColor: surface,
        boxShadow: "none",
        padding: "12px 14px",
        fontWeight: "700",
        color: ink,
      },
      ".PickerItem:hover": {
        backgroundColor: mutedBg,
      },
      ".PickerItem--selected": {
        borderColor: accent,
        backgroundColor: accentSoft,
        boxShadow: `0 0 0 1px ${accent}`,
      },
    },
  }
}
