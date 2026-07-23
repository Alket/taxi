import type { Prisma } from "@prisma/client"

import { prisma } from "@/lib/db"
import type {
  AirportEntry,
  ConnectionStatus,
  DisplayCurrency,
  NotificationChannels,
  PaymentMode,
  Settings,
} from "@/lib/types"

const SETTINGS_ID = "default"
const VALID_CURRENCIES: DisplayCurrency[] = ["EUR", "USD", "GBP"]

export function computeStripeMode(): PaymentMode {
  // Prefer DB mode when available; this helper is only used as an env fallback.
  const key = process.env.STRIPE_SECRET_KEY ?? ""
  return key.startsWith("sk_live_") ? "live" : "test"
}

export function computePaypalMode(): PaymentMode {
  if (process.env.PAYPAL_MODE === "live") return "live"
  const clientId = process.env.PAYPAL_CLIENT_ID ?? ""
  return clientId.startsWith("live_") || clientId.includes("live")
    ? "live"
    : "test"
}

export function computeWhatsappConnectionStatus(): ConnectionStatus {
  const token =
    process.env.WHATSAPP_API_TOKEN ??
    process.env.WHATSAPP_ACCESS_TOKEN ??
    process.env.WHATSAPP_TOKEN
  return token ? "connected" : "disconnected"
}

export function parseAirports(value: unknown): AirportEntry[] {
  if (!Array.isArray(value)) return []

  return value
    .map((entry) => {
      const record = entry as Record<string, unknown>
      const name = typeof record.name === "string" ? record.name.trim() : ""
      const iataCode =
        typeof record.iataCode === "string"
          ? record.iataCode.trim().toUpperCase().slice(0, 3)
          : typeof record.iata === "string"
            ? record.iata.trim().toUpperCase().slice(0, 3)
            : ""
      return { name, iataCode }
    })
    .filter((entry) => entry.name || entry.iataCode)
}

export function parseNotificationChannels(value: unknown): NotificationChannels {
  const defaults: NotificationChannels = {
    confirmation: true,
    driverAssigned: true,
    flightDelay: true,
    reminder: true,
    cancellation: true,
    dateChange: true,
    completedReceipt: true,
  }

  if (!value || typeof value !== "object") return defaults

  const record = value as Record<string, unknown>
  return {
    confirmation:
      typeof record.confirmation === "boolean"
        ? record.confirmation
        : defaults.confirmation,
    driverAssigned:
      typeof record.driverAssigned === "boolean"
        ? record.driverAssigned
        : defaults.driverAssigned,
    flightDelay:
      typeof record.flightDelay === "boolean"
        ? record.flightDelay
        : defaults.flightDelay,
    reminder:
      typeof record.reminder === "boolean" ? record.reminder : defaults.reminder,
    cancellation:
      typeof record.cancellation === "boolean"
        ? record.cancellation
        : defaults.cancellation,
    dateChange:
      typeof record.dateChange === "boolean"
        ? record.dateChange
        : defaults.dateChange,
    completedReceipt:
      typeof record.completedReceipt === "boolean"
        ? record.completedReceipt
        : defaults.completedReceipt,
  }
}

export function serializeSettings(
  row: Prisma.SettingsGetPayload<Record<string, never>>,
): Settings {
  return {
    companyName: row.companyName,
    supportPhone: row.supportPhone,
    supportEmail: row.supportEmail,
    supportWhatsApp: row.supportWhatsApp,
    adminNotificationEmail: row.adminNotificationEmail ?? "",
    displayCurrencies: row.displayCurrencies.filter((currency): currency is DisplayCurrency =>
      VALID_CURRENCIES.includes(currency as DisplayCurrency),
    ),
    freeCancellationHours: row.freeCancellationHours,
    depositPercentage: row.depositPercentage,
    roundTripDiscountPercent: row.roundTripDiscountPercent ?? 0,
    infantCarrierPrice: Number(row.infantCarrierPrice ?? 0),
    childSeatPrice: Number(row.childSeatPrice ?? 0),
    boosterSeatPrice: Number(row.boosterSeatPrice ?? 0),
    stripeEnabled: row.stripeEnabled ?? true,
    paypalEnabled: row.paypalEnabled ?? true,
    cashOnArrivalEnabled: row.cashOnArrivalEnabled ?? false,
    depositPaymentEnabled: row.depositPaymentEnabled ?? true,
    fullPaymentEnabled: row.fullPaymentEnabled ?? true,
    airports: parseAirports(row.airports),
    notificationChannelsEnabled: parseNotificationChannels(
      row.notificationChannelsEnabled,
    ),
    flightDelayThresholdMinutes: row.flightDelayThresholdMinutes,
    whatsappConnectionStatus: computeWhatsappConnectionStatus(),
    stripeMode: row.stripeMode === "live" ? "live" : "test",
    paypalMode: row.paypalMode === "live" ? "live" : "test",
    stripeTestPublishableKey: row.stripeTestPublishableKey ?? "",
    stripeLivePublishableKey: row.stripeLivePublishableKey ?? "",
    stripeTestSecretKeySet: Boolean(row.stripeTestSecretKey),
    stripeLiveSecretKeySet: Boolean(row.stripeLiveSecretKey),
    stripeTestWebhookSecretSet: Boolean(row.stripeTestWebhookSecret),
    stripeLiveWebhookSecretSet: Boolean(row.stripeLiveWebhookSecret),
    paypalSandboxClientId: row.paypalSandboxClientId ?? "",
    paypalLiveClientId: row.paypalLiveClientId ?? "",
    paypalSandboxSecretSet: Boolean(row.paypalSandboxSecret),
    paypalLiveSecretSet: Boolean(row.paypalLiveSecret),
  }
}

/** Prefer dedicated ops inbox; fall back to support email. */
export function resolveAdminNotificationEmail(settings: Settings): string | null {
  const dedicated = settings.adminNotificationEmail?.trim()
  if (dedicated) return dedicated
  const support = settings.supportEmail?.trim()
  return support || null
}

export async function getSettingsRow() {
  const row = await prisma.settings.findUnique({ where: { id: SETTINGS_ID } })
  if (!row) {
    throw new Error("Settings not configured.")
  }
  return row
}

export async function getSettings(): Promise<Settings> {
  return serializeSettings(await getSettingsRow())
}

export async function getBookingPolicy() {
  const row = await getSettingsRow()
  return {
    currency: (row.displayCurrencies[0] ?? "EUR") as DisplayCurrency,
    depositPercentage: row.depositPercentage,
    freeCancellationHours: row.freeCancellationHours,
    infantCarrierPrice: Number(row.infantCarrierPrice ?? 0),
    childSeatPrice: Number(row.childSeatPrice ?? 0),
    boosterSeatPrice: Number(row.boosterSeatPrice ?? 0),
  }
}

export function clampNumber(
  value: unknown,
  min: number,
  max: number,
  fallback: number,
) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(max, Math.max(min, parsed))
}

export { VALID_CURRENCIES, SETTINGS_ID }
