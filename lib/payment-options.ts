import type { PaymentOption } from "@/lib/types"

export type { PaymentOption }

/**
 * Validate a requested payment option against what the admin has enabled,
 * falling back to whatever is available (deposit preferred).
 */
export function normalizePaymentOption(
  raw: unknown,
  opts: { depositEnabled: boolean; fullEnabled: boolean },
): PaymentOption {
  const wanted: PaymentOption | null =
    raw === "full" ? "full" : raw === "deposit" ? "deposit" : null

  if (wanted === "full" && opts.fullEnabled) return "full"
  if (wanted === "deposit" && opts.depositEnabled) return "deposit"

  if (opts.depositEnabled) return "deposit"
  if (opts.fullEnabled) return "full"
  return "deposit"
}
