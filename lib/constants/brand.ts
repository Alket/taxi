/** Central brand value claims — keep UI badges and JSON-LD in sync. */
export const BRAND_CLAIMS = {
  zeroDeposit: "€0 Deposit",
  payCash: "Pay Cash on Arrival",
  flightTracking: "Free Flight Tracking",
  meetGreet: "Driver Meet & Greet Included",
} as const

export type BrandClaimKey = keyof typeof BRAND_CLAIMS
