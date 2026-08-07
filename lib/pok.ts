/**
 * POK Payments (pokpay.io) REST helpers.
 *
 * Flow: the server exchanges keyId/keySecret for a short-lived access token,
 * creates an SDK order, and hands only the order id to the browser. The POK
 * card form (`@nebula-ltd/pok-payments-js`) collects the card, runs 3-D Secure
 * and captures. The server then re-reads the order to confirm the capture
 * before the booking is marked paid.
 *
 * Credentials come from admin Settings first (pokMode + per-mode key id /
 * secret / merchant id), falling back to env vars: POK_KEY_ID,
 * POK_KEY_SECRET, POK_MERCHANT_ID, POK_MODE=staging|live.
 *
 * Docs: https://payments.doc.pokpay.io/ and https://docs.pokpay.io/rest-api
 */

import { prisma } from "@/lib/db"
import { decryptSecret } from "@/lib/secret-box"
import { SETTINGS_ID } from "@/lib/settings"
import type { PaymentMode } from "@/lib/types"
import { round2 } from "@/lib/vehicles"

export type PokConfig = {
  configured: boolean
  mode: PaymentMode
  /** Value the browser SDK expects for `options.env`. */
  environment: "staging" | "production"
  keyId: string
  keySecret: string
  merchantId: string
  baseUrl: string
}

/** Max absolute difference (major currency units) allowed vs expected. */
export const POK_AMOUNT_TOLERANCE = 0.02

/** POK expires unpaid SDK orders after this long. */
export const POK_ORDER_EXPIRY_MINUTES = 60

const STAGING_BASE_URL = "https://api-staging.pokpay.io"
const LIVE_BASE_URL = "https://api.pokpay.io"

function baseUrlForMode(mode: PaymentMode) {
  const override = process.env.POK_API_BASE_URL?.trim()
  if (override) return override.replace(/\/+$/, "")
  return mode === "live" ? LIVE_BASE_URL : STAGING_BASE_URL
}

export async function getPokConfig(): Promise<PokConfig> {
  let mode: PaymentMode = "test"
  let keyId = ""
  let keySecret = ""
  let merchantId = ""

  try {
    const row = await prisma.settings.findUnique({
      where: { id: SETTINGS_ID },
      select: {
        pokMode: true,
        pokStagingKeyId: true,
        pokStagingKeySecret: true,
        pokStagingMerchantId: true,
        pokLiveKeyId: true,
        pokLiveKeySecret: true,
        pokLiveMerchantId: true,
      },
    })
    if (row) {
      mode = row.pokMode === "live" ? "live" : "test"
      if (mode === "live") {
        keyId = row.pokLiveKeyId || ""
        keySecret = row.pokLiveKeySecret || ""
        merchantId = row.pokLiveMerchantId || ""
      } else {
        keyId = row.pokStagingKeyId || ""
        keySecret = row.pokStagingKeySecret || ""
        merchantId = row.pokStagingMerchantId || ""
      }
      if (keySecret) keySecret = decryptSecret(keySecret)
    }
  } catch {
    // Settings unavailable — fall back to env vars below.
  }

  if (!keyId && !keySecret) {
    const envMode = process.env.POK_MODE?.trim().toLowerCase()
    if (envMode === "live" || envMode === "production") mode = "live"
    keyId = process.env.POK_KEY_ID || ""
    keySecret = process.env.POK_KEY_SECRET || ""
    merchantId = merchantId || process.env.POK_MERCHANT_ID || ""
  }

  return {
    configured: Boolean(keyId && keySecret && merchantId),
    mode,
    environment: mode === "live" ? "production" : "staging",
    keyId,
    keySecret,
    merchantId,
    baseUrl: baseUrlForMode(mode),
  }
}

export async function isPokConfigured(): Promise<boolean> {
  return (await getPokConfig()).configured
}

type CachedToken = { token: string; expiresAt: number }

const tokenCache = new Map<string, CachedToken>()

/** Renew a little early so a long request can't run into an expiring token. */
const TOKEN_EXPIRY_SKEW_MS = 60_000

async function getAccessToken(config: PokConfig): Promise<string> {
  if (!config.configured) {
    throw new Error("POK is not configured.")
  }

  const cacheKey = `${config.baseUrl}:${config.keyId}`
  const cached = tokenCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) return cached.token

  const res = await fetch(`${config.baseUrl}/auth/sdk/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      keyId: config.keyId,
      keySecret: config.keySecret,
    }),
    cache: "no-store",
  })

  const data = await res.json().catch(() => null)
  if (!res.ok) {
    throw new Error(formatPokError(data, "Failed to authenticate with POK."))
  }

  const payload = (data?.data ?? {}) as {
    accessToken?: string
    expiresIn?: string | number
  }
  const token = payload.accessToken
  if (!token) {
    throw new Error("POK login did not return an access token.")
  }

  // POK reports `expiresIn` in milliseconds in some samples and seconds in
  // others; values small enough to be a sane second count are read as seconds.
  const rawExpiry = Number(payload.expiresIn)
  const lifetimeMs = !Number.isFinite(rawExpiry) || rawExpiry <= 0
    ? 5 * 60_000
    : rawExpiry <= 86_400
      ? rawExpiry * 1000
      : rawExpiry
  tokenCache.set(cacheKey, {
    token,
    expiresAt: Date.now() + Math.max(30_000, lifetimeMs - TOKEN_EXPIRY_SKEW_MS),
  })

  return token
}

export type PokOrder = {
  id: string
  amount: number | null
  capturedAmount: number | null
  currencyCode: string | null
  merchantCustomReference: string | null
}

function toNumber(value: unknown): number | null {
  if (value == null) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? round2(parsed) : null
}

function parseSdkOrder(data: unknown): PokOrder | null {
  const root = (data ?? {}) as Record<string, unknown>
  const container = (root.data ?? root) as Record<string, unknown>
  const raw = (container.sdkOrder ?? container) as Record<string, unknown>
  const id = typeof raw.id === "string" ? raw.id : null
  if (!id) return null

  return {
    id,
    amount: toNumber(raw.amount),
    capturedAmount: toNumber(raw.capturedAmount),
    currencyCode:
      typeof raw.currencyCode === "string"
        ? raw.currencyCode.toUpperCase()
        : null,
    merchantCustomReference:
      typeof raw.merchantCustomReference === "string"
        ? raw.merchantCustomReference
        : null,
  }
}

export async function createPokOrder({
  amount,
  currency,
  referenceCode,
  description,
  redirectUrl,
  failRedirectUrl,
  webhookUrl,
}: {
  amount: number
  currency: string
  referenceCode: string
  description: string
  redirectUrl: string
  failRedirectUrl: string
  webhookUrl?: string
}): Promise<PokOrder> {
  const config = await getPokConfig()
  const token = await getAccessToken(config)

  const res = await fetch(
    `${config.baseUrl}/merchants/${encodeURIComponent(config.merchantId)}/sdk-orders`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: amount.toFixed(2),
        currencyCode: currency.toUpperCase(),
        autoCapture: true,
        shippingCost: 0,
        description,
        merchantCustomReference: referenceCode,
        redirectUrl,
        failRedirectUrl,
        expiresAfterMinutes: POK_ORDER_EXPIRY_MINUTES,
        ...(webhookUrl ? { webhookUrl } : {}),
      }),
      cache: "no-store",
    },
  )

  const data = await res.json().catch(() => null)
  if (!res.ok) {
    throw new Error(formatPokError(data, "Failed to create POK order."))
  }

  const order = parseSdkOrder(data)
  if (!order) {
    throw new Error("POK did not return an order id.")
  }
  return order
}

/** Current server-side state of an order — the only trusted capture signal. */
export async function getPokOrder(orderId: string): Promise<PokOrder> {
  const config = await getPokConfig()
  const token = await getAccessToken(config)

  const res = await fetch(
    `${config.baseUrl}/sdk-orders/${encodeURIComponent(orderId)}`,
    {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    },
  )

  const data = await res.json().catch(() => null)
  if (!res.ok) {
    throw new Error(formatPokError(data, "Failed to read the POK order."))
  }

  const order = parseSdkOrder(data)
  if (!order) {
    throw new Error("POK order could not be read.")
  }
  return order
}

export function amountsMatch(
  actual: number,
  expected: number,
  tolerance = POK_AMOUNT_TOLERANCE,
) {
  return Math.abs(round2(actual) - round2(expected)) <= tolerance
}

function formatPokError(data: unknown, fallback: string) {
  const body = (data ?? {}) as {
    message?: string
    error?: string
    errors?: Array<{ message?: string } | string>
  }
  const first = Array.isArray(body.errors) ? body.errors[0] : undefined
  const detail =
    typeof first === "string" ? first : (first?.message ?? undefined)
  return detail || body.message || body.error || fallback
}
