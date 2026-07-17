/**
 * Stripe helpers. Credentials are resolved from admin Settings first
 * (stripeMode + per-mode publishable/secret/webhook), falling back to env:
 * STRIPE_SECRET_KEY, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY, STRIPE_WEBHOOK_SECRET
 */

import Stripe from "stripe"

import { prisma } from "@/lib/db"
import { SETTINGS_ID } from "@/lib/settings"

type StripeMode = "test" | "live"

export type StripeConfig = {
  configured: boolean
  mode: StripeMode
  publishableKey: string
  secretKey: string
  webhookSecret: string
}

let stripeClient: Stripe | null = null
let stripeClientKey: string | null = null

export async function getStripeConfig(): Promise<StripeConfig> {
  let mode: StripeMode = "test"
  let publishableKey = ""
  let secretKey = ""
  let webhookSecret = ""

  try {
    const row = await prisma.settings.findUnique({
      where: { id: SETTINGS_ID },
      select: {
        stripeMode: true,
        stripeTestPublishableKey: true,
        stripeTestSecretKey: true,
        stripeTestWebhookSecret: true,
        stripeLivePublishableKey: true,
        stripeLiveSecretKey: true,
        stripeLiveWebhookSecret: true,
      },
    })
    if (row) {
      mode = row.stripeMode === "live" ? "live" : "test"
      if (mode === "live") {
        publishableKey = row.stripeLivePublishableKey || ""
        secretKey = row.stripeLiveSecretKey || ""
        webhookSecret = row.stripeLiveWebhookSecret || ""
      } else {
        publishableKey = row.stripeTestPublishableKey || ""
        secretKey = row.stripeTestSecretKey || ""
        webhookSecret = row.stripeTestWebhookSecret || ""
      }
    }
  } catch {
    // Settings unavailable — fall back to env vars below.
  }

  // Env fallback when DB has no secret for the selected mode.
  if (!secretKey) {
    const envSecret = process.env.STRIPE_SECRET_KEY || ""
    if (envSecret) {
      secretKey = envSecret
      mode = envSecret.startsWith("sk_live_") ? "live" : "test"
    }
  }
  if (!publishableKey) {
    publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || ""
  }
  if (!webhookSecret) {
    webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || ""
  }

  return {
    configured: Boolean(secretKey && publishableKey),
    mode,
    publishableKey,
    secretKey,
    webhookSecret,
  }
}

export async function isStripeConfigured(): Promise<boolean> {
  return (await getStripeConfig()).configured
}

export async function getStripe(): Promise<Stripe> {
  const config = await getStripeConfig()
  if (!config.secretKey) {
    throw new Error("Stripe secret key is not configured.")
  }

  if (!stripeClient || stripeClientKey !== config.secretKey) {
    stripeClient = new Stripe(config.secretKey, {
      apiVersion: "2026-06-24.dahlia",
    })
    stripeClientKey = config.secretKey
  }

  return stripeClient
}

export async function getStripeWebhookSecret(): Promise<string> {
  const secret = (await getStripeConfig()).webhookSecret
  if (!secret) {
    throw new Error("Stripe webhook secret is not configured.")
  }
  return secret
}
