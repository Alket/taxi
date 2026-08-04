import { NextResponse } from "next/server"

import { requireAdmin } from "@/lib/auth"
import { prisma } from "@/lib/db"
import {
  clampNumber,
  getSettings,
  getSettingsRow,
  parseAirports,
  parseNotificationChannels,
  serializeSettings,
  SETTINGS_ID,
  VALID_CURRENCIES,
} from "@/lib/settings"
import { encryptSecret } from "@/lib/secret-box"
import {
  assertSmtpHostAllowed,
  assertSmtpPortAllowed,
} from "@/lib/smtp-security"
import type { DisplayCurrency, NotificationChannels } from "@/lib/types"

export async function GET() {
  const denied = await requireAdmin(
    "Your account cannot access settings. Ask an admin.",
  )
  if (denied) return denied

  try {
    const settings = await getSettings()
    return NextResponse.json({ settings })
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || "Settings not configured." },
      { status: 500 },
    )
  }
}

export async function PATCH(request: Request) {
  const denied = await requireAdmin(
    "Your account cannot change settings. Ask an admin.",
  )
  if (denied) return denied

  const body = await request.json().catch(() => ({}))

  try {
    const current = await getSettingsRow()
    const data: Record<string, unknown> = {}

    if (typeof body.companyName === "string") {
      data.companyName = body.companyName.trim()
    }
    if (typeof body.supportPhone === "string") {
      data.supportPhone = body.supportPhone.trim()
    }
    if (typeof body.supportEmail === "string") {
      data.supportEmail = body.supportEmail.trim()
    }
    if (typeof body.supportWhatsApp === "string") {
      data.supportWhatsApp = body.supportWhatsApp.trim()
    }
    if (typeof body.adminNotificationEmail === "string") {
      data.adminNotificationEmail = body.adminNotificationEmail.trim()
    }
    if (typeof body.faviconUrl === "string") {
      const url = body.faviconUrl.trim()
      if (
        url &&
        !url.startsWith("/uploads/") &&
        !url.startsWith("/marketing/") &&
        !/^https?:\/\//i.test(url)
      ) {
        return NextResponse.json(
          { error: "Favicon must be an uploaded image URL or https link." },
          { status: 400 },
        )
      }
      data.faviconUrl = url
    }
    if (typeof body.searchIndexingEnabled === "boolean") {
      data.searchIndexingEnabled = body.searchIndexingEnabled
    }

    if (Array.isArray(body.displayCurrencies)) {
      const filtered = body.displayCurrencies.filter(
        (currency: unknown): currency is DisplayCurrency =>
          VALID_CURRENCIES.includes(currency as DisplayCurrency),
      )
      if (filtered.length === 0) {
        return NextResponse.json(
          { error: "Select at least one display currency." },
          { status: 400 },
        )
      }
      data.displayCurrencies = filtered
    }

    if (body.freeCancellationHours !== undefined) {
      data.freeCancellationHours = clampNumber(
        body.freeCancellationHours,
        0,
        336,
        current.freeCancellationHours,
      )
    }

    if (body.depositPercentage !== undefined) {
      data.depositPercentage = clampNumber(
        body.depositPercentage,
        0,
        100,
        current.depositPercentage,
      )
    }

    if (body.roundTripDiscountPercent !== undefined) {
      data.roundTripDiscountPercent = clampNumber(
        body.roundTripDiscountPercent,
        0,
        100,
        current.roundTripDiscountPercent ?? 0,
      )
    }

    if (body.infantCarrierPrice !== undefined) {
      data.infantCarrierPrice = clampNumber(
        body.infantCarrierPrice,
        0,
        500,
        Number(current.infantCarrierPrice ?? 0),
      )
    }
    if (body.childSeatPrice !== undefined) {
      data.childSeatPrice = clampNumber(
        body.childSeatPrice,
        0,
        500,
        Number(current.childSeatPrice ?? 0),
      )
    }
    if (body.boosterSeatPrice !== undefined) {
      data.boosterSeatPrice = clampNumber(
        body.boosterSeatPrice,
        0,
        500,
        Number(current.boosterSeatPrice ?? 0),
      )
    }

    if (typeof body.stripeEnabled === "boolean") {
      data.stripeEnabled = body.stripeEnabled
    }
    if (typeof body.paypalEnabled === "boolean") {
      data.paypalEnabled = body.paypalEnabled
    }
    if (typeof body.cashOnArrivalEnabled === "boolean") {
      data.cashOnArrivalEnabled = body.cashOnArrivalEnabled
    }
    if (typeof body.depositPaymentEnabled === "boolean") {
      data.depositPaymentEnabled = body.depositPaymentEnabled
    }
    if (typeof body.fullPaymentEnabled === "boolean") {
      data.fullPaymentEnabled = body.fullPaymentEnabled
    }

    if (body.paypalMode === "live" || body.paypalMode === "test") {
      data.paypalMode = body.paypalMode
    }
    if (typeof body.paypalSandboxClientId === "string") {
      data.paypalSandboxClientId = body.paypalSandboxClientId.trim()
    }
    if (typeof body.paypalLiveClientId === "string") {
      data.paypalLiveClientId = body.paypalLiveClientId.trim()
    }
    // Secrets: only overwrite when a non-empty value is provided so the UI can
    // leave the field blank to keep the existing secret.
    if (
      typeof body.paypalSandboxSecret === "string" &&
      body.paypalSandboxSecret.trim().length > 0
    ) {
      data.paypalSandboxSecret = body.paypalSandboxSecret.trim()
    }
    if (
      typeof body.paypalLiveSecret === "string" &&
      body.paypalLiveSecret.trim().length > 0
    ) {
      data.paypalLiveSecret = body.paypalLiveSecret.trim()
    }

    if (body.stripeMode === "live" || body.stripeMode === "test") {
      data.stripeMode = body.stripeMode
    }
    if (typeof body.stripeTestPublishableKey === "string") {
      data.stripeTestPublishableKey = body.stripeTestPublishableKey.trim()
    }
    if (typeof body.stripeLivePublishableKey === "string") {
      data.stripeLivePublishableKey = body.stripeLivePublishableKey.trim()
    }
    if (
      typeof body.stripeTestSecretKey === "string" &&
      body.stripeTestSecretKey.trim().length > 0
    ) {
      data.stripeTestSecretKey = body.stripeTestSecretKey.trim()
    }
    if (
      typeof body.stripeLiveSecretKey === "string" &&
      body.stripeLiveSecretKey.trim().length > 0
    ) {
      data.stripeLiveSecretKey = body.stripeLiveSecretKey.trim()
    }

    const nextTestPk =
      typeof data.stripeTestPublishableKey === "string"
        ? data.stripeTestPublishableKey
        : undefined
    const nextTestSk =
      typeof data.stripeTestSecretKey === "string"
        ? data.stripeTestSecretKey
        : undefined
    const nextLivePk =
      typeof data.stripeLivePublishableKey === "string"
        ? data.stripeLivePublishableKey
        : undefined
    const nextLiveSk =
      typeof data.stripeLiveSecretKey === "string"
        ? data.stripeLiveSecretKey
        : undefined

    if (nextTestPk && nextTestPk.startsWith("sk_")) {
      return NextResponse.json(
        {
          error:
            "Test publishable key looks like a secret key (starts with sk_). Use the pk_test_… key instead.",
        },
        { status: 400 },
      )
    }
    if (nextTestSk && nextTestSk.startsWith("pk_")) {
      return NextResponse.json(
        {
          error:
            "Test secret key looks like a publishable key (starts with pk_). Use the sk_test_… key instead.",
        },
        { status: 400 },
      )
    }
    if (nextLivePk && nextLivePk.startsWith("sk_")) {
      return NextResponse.json(
        {
          error:
            "Live publishable key looks like a secret key (starts with sk_). Use the pk_live_… key instead.",
        },
        { status: 400 },
      )
    }
    if (nextLiveSk && nextLiveSk.startsWith("pk_")) {
      return NextResponse.json(
        {
          error:
            "Live secret key looks like a publishable key (starts with pk_). Use the sk_live_… key instead.",
        },
        { status: 400 },
      )
    }
    if (
      typeof body.stripeTestWebhookSecret === "string" &&
      body.stripeTestWebhookSecret.trim().length > 0
    ) {
      data.stripeTestWebhookSecret = body.stripeTestWebhookSecret.trim()
    }
    if (
      typeof body.stripeLiveWebhookSecret === "string" &&
      body.stripeLiveWebhookSecret.trim().length > 0
    ) {
      data.stripeLiveWebhookSecret = body.stripeLiveWebhookSecret.trim()
    }

    if (Array.isArray(body.airports)) {
      const cleaned = parseAirports(body.airports).map((airport) => ({
        name: airport.name,
        iataCode: airport.iataCode,
      }))
      data.airports = cleaned
    }

    if (body.notificationChannelsEnabled) {
      const keys: (keyof NotificationChannels)[] = [
        "confirmation",
        "driverAssigned",
        "flightDelay",
        "reminder",
        "cancellation",
        "dateChange",
        "completedReceipt",
      ]
      const next = parseNotificationChannels(current.notificationChannelsEnabled)
      for (const key of keys) {
        const value = body.notificationChannelsEnabled[key]
        if (typeof value === "boolean") next[key] = value
      }
      data.notificationChannelsEnabled = next
    }

    if (body.flightDelayThresholdMinutes !== undefined) {
      data.flightDelayThresholdMinutes = clampNumber(
        body.flightDelayThresholdMinutes,
        5,
        600,
        current.flightDelayThresholdMinutes,
      )
    }

    if (typeof body.smtpHost === "string") {
      const host = body.smtpHost.trim()
      if (host) {
        try {
          data.smtpHost = await assertSmtpHostAllowed(host)
        } catch (err) {
          return NextResponse.json(
            { error: (err as Error).message },
            { status: 400 },
          )
        }
      } else {
        data.smtpHost = ""
      }
    }
    if (body.smtpPort !== undefined) {
      const port = clampNumber(body.smtpPort, 1, 65535, 465)
      try {
        data.smtpPort = assertSmtpPortAllowed(port)
      } catch (err) {
        return NextResponse.json(
          { error: (err as Error).message },
          { status: 400 },
        )
      }
    }
    if (typeof body.smtpSecure === "boolean") {
      data.smtpSecure = body.smtpSecure
    }
    if (typeof body.smtpUser === "string") {
      data.smtpUser = body.smtpUser.trim()
    }
    if (typeof body.smtpFrom === "string") {
      data.smtpFrom = body.smtpFrom.trim()
    }
    if (typeof body.smtpTlsRejectUnauthorized === "boolean") {
      data.smtpTlsRejectUnauthorized = body.smtpTlsRejectUnauthorized
    }
    // Password: only overwrite when a non-empty value is provided; store encrypted.
    if (typeof body.smtpPass === "string" && body.smtpPass.trim().length > 0) {
      data.smtpPass = encryptSecret(body.smtpPass.trim())
    }

    const existingHost = String(
      (current as unknown as { smtpHost?: string }).smtpHost ?? "",
    ).trim()
    if (
      typeof data.smtpHost !== "string" &&
      existingHost &&
      (data.smtpPass || data.smtpPort)
    ) {
      try {
        await assertSmtpHostAllowed(existingHost)
      } catch (err) {
        return NextResponse.json(
          { error: (err as Error).message },
          { status: 400 },
        )
      }
    }

    const updated = await prisma.settings.update({
      where: { id: SETTINGS_ID },
      data,
    })

    return NextResponse.json({ settings: serializeSettings(updated) })
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || "Failed to update settings." },
      { status: 500 },
    )
  }
}
