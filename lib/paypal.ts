/**
 * Minimal PayPal REST helpers for deposit capture.
 *
 * Credentials and environment are resolved from admin Settings first
 * (paypalMode + per-mode client id/secret), falling back to env vars:
 * PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PAYPAL_MODE=sandbox|live
 */

import { prisma } from "@/lib/db"
import { SETTINGS_ID } from "@/lib/settings"

type PaypalMode = "sandbox" | "live"

export type PaypalConfig = {
  configured: boolean
  mode: PaypalMode
  clientId: string
  secret: string
  baseUrl: string
}

function baseUrlForMode(mode: PaypalMode) {
  return mode === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com"
}

export async function getPaypalConfig(): Promise<PaypalConfig> {
  let mode: PaypalMode = "sandbox"
  let clientId = ""
  let secret = ""

  try {
    const row = await prisma.settings.findUnique({
      where: { id: SETTINGS_ID },
      select: {
        paypalMode: true,
        paypalSandboxClientId: true,
        paypalSandboxSecret: true,
        paypalLiveClientId: true,
        paypalLiveSecret: true,
      },
    })
    if (row) {
      mode = row.paypalMode === "live" ? "live" : "sandbox"
      if (mode === "live") {
        clientId = row.paypalLiveClientId || ""
        secret = row.paypalLiveSecret || ""
      } else {
        clientId = row.paypalSandboxClientId || ""
        secret = row.paypalSandboxSecret || ""
      }
    }
  } catch {
    // Settings unavailable — fall back to env vars below.
  }

  // Backward-compatible env fallback (used only when DB has no credentials).
  if (!clientId && !secret) {
    if (process.env.PAYPAL_MODE === "live") mode = "live"
    clientId = process.env.PAYPAL_CLIENT_ID || ""
    secret = process.env.PAYPAL_CLIENT_SECRET || ""
  }

  return {
    configured: Boolean(clientId && secret),
    mode,
    clientId,
    secret,
    baseUrl: baseUrlForMode(mode),
  }
}

export async function isPaypalConfigured(): Promise<boolean> {
  return (await getPaypalConfig()).configured
}

async function getAccessToken(config: PaypalConfig): Promise<string> {
  if (!config.configured) {
    throw new Error("PayPal is not configured.")
  }

  const auth = Buffer.from(`${config.clientId}:${config.secret}`).toString(
    "base64",
  )
  const res = await fetch(`${config.baseUrl}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  })

  if (!res.ok) {
    throw new Error("Failed to authenticate with PayPal.")
  }

  const data = (await res.json()) as { access_token: string }
  return data.access_token
}

export async function createPaypalOrder({
  amount,
  currency,
  bookingId,
  referenceCode,
  returnUrl,
  cancelUrl,
}: {
  amount: number
  currency: string
  bookingId: string
  referenceCode: string
  returnUrl: string
  cancelUrl: string
}) {
  const config = await getPaypalConfig()
  const token = await getAccessToken(config)
  const res = await fetch(`${config.baseUrl}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: bookingId,
          description: `Transfer deposit ${referenceCode}`,
          custom_id: bookingId,
          amount: {
            currency_code: currency.toUpperCase(),
            value: amount.toFixed(2),
          },
        },
      ],
      application_context: {
        brand_name: "Airport Transfers",
        shipping_preference: "NO_SHIPPING",
        user_action: "PAY_NOW",
        return_url: returnUrl,
        cancel_url: cancelUrl,
      },
    }),
  })

  const data = await res.json()
  if (!res.ok) {
    throw new Error(formatPaypalError(data, "Failed to create PayPal order."))
  }

  const approve = (data.links as { rel: string; href: string }[] | undefined)?.find(
    (link) => link.rel === "approve",
  )

  return {
    orderId: data.id as string,
    approveUrl: approve?.href as string | undefined,
  }
}

export async function capturePaypalOrder(orderId: string) {
  const config = await getPaypalConfig()
  const token = await getAccessToken(config)
  const res = await fetch(
    `${config.baseUrl}/v2/checkout/orders/${orderId}/capture`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    },
  )

  const data = await res.json()
  if (!res.ok) {
    throw new Error(formatPaypalError(data, "Failed to capture PayPal payment."))
  }

  return data as {
    id: string
    status: string
    purchase_units?: Array<{
      reference_id?: string
      payments?: {
        captures?: Array<{ id: string; status: string }>
      }
    }>
  }
}

function formatPaypalError(
  data: {
    message?: string
    name?: string
    details?: Array<{ issue?: string; description?: string }>
    debug_id?: string
  },
  fallback: string,
) {
  const detail = data?.details?.[0]
  const issue = detail?.issue
  const description = detail?.description
  const parts = [
    issue,
    description || data?.message || fallback,
    data?.debug_id ? `(debug_id: ${data.debug_id})` : null,
  ].filter(Boolean)
  return parts.join(" — ") || fallback
}
