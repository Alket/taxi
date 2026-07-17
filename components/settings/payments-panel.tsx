"use client"

import * as React from "react"
import { toast } from "sonner"
import { AlertTriangleIcon, BanknoteIcon, CheckCircle2Icon } from "lucide-react"

import { apiPatch } from "@/lib/api"
import type { PaymentMode, Settings } from "@/lib/types"
import { ToneBadge } from "@/components/admin/status-badges"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Field, PanelCard } from "@/components/settings/shared"

function ModeBadge({
  mode,
  testLabel = "Test mode",
}: {
  mode: PaymentMode
  testLabel?: string
}) {
  const isLive = mode === "live"
  return (
    <ToneBadge tone={isLive ? "warning" : "neutral"} dot={isLive}>
      {isLive ? "Live mode" : testLabel}
    </ToneBadge>
  )
}

function MethodRow({
  title,
  description,
  enabled,
  pending,
  onToggle,
  trailing,
}: {
  title: string
  description: string
  enabled: boolean
  pending: boolean
  onToggle: (next: boolean) => void
  trailing?: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-3">
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">{title}</span>
          {trailing}
        </div>
        <span className="text-xs text-muted-foreground">{description}</span>
      </div>
      <div className="flex items-center gap-2.5">
        <span className="text-xs text-muted-foreground">
          {enabled ? "Active" : "Off"}
        </span>
        <Switch
          checked={enabled}
          disabled={pending}
          onCheckedChange={onToggle}
          aria-label={`Toggle ${title}`}
        />
      </div>
    </div>
  )
}

export function PaymentsPanel({
  settings,
  onSaved,
}: {
  settings: Settings
  onSaved: () => void
}) {
  const [stripeEnabled, setStripeEnabled] = React.useState(settings.stripeEnabled)
  const [paypalEnabled, setPaypalEnabled] = React.useState(settings.paypalEnabled)
  const [cashOnArrivalEnabled, setCashOnArrivalEnabled] = React.useState(
    settings.cashOnArrivalEnabled,
  )
  const [depositPaymentEnabled, setDepositPaymentEnabled] = React.useState(
    settings.depositPaymentEnabled,
  )
  const [fullPaymentEnabled, setFullPaymentEnabled] = React.useState(
    settings.fullPaymentEnabled,
  )
  const [pendingKey, setPendingKey] = React.useState<string | null>(null)

  React.useEffect(() => {
    setStripeEnabled(settings.stripeEnabled)
    setPaypalEnabled(settings.paypalEnabled)
    setCashOnArrivalEnabled(settings.cashOnArrivalEnabled)
    setDepositPaymentEnabled(settings.depositPaymentEnabled)
    setFullPaymentEnabled(settings.fullPaymentEnabled)
  }, [
    settings.stripeEnabled,
    settings.paypalEnabled,
    settings.cashOnArrivalEnabled,
    settings.depositPaymentEnabled,
    settings.fullPaymentEnabled,
  ])

  const anyLive =
    settings.stripeMode === "live" || settings.paypalMode === "live"
  const noneEnabled =
    !stripeEnabled && !paypalEnabled && !cashOnArrivalEnabled
  const anyOnline = stripeEnabled || paypalEnabled
  const noAmountOption = !depositPaymentEnabled && !fullPaymentEnabled

  async function updateMethod(
    key:
      | "stripeEnabled"
      | "paypalEnabled"
      | "cashOnArrivalEnabled"
      | "depositPaymentEnabled"
      | "fullPaymentEnabled",
    value: boolean,
    apply: (value: boolean) => void,
  ) {
    const previousByKey: Record<typeof key, boolean> = {
      stripeEnabled,
      paypalEnabled,
      cashOnArrivalEnabled,
      depositPaymentEnabled,
      fullPaymentEnabled,
    }
    const previous = previousByKey[key]

    apply(value)
    setPendingKey(key)
    try {
      await apiPatch("/api/admin/settings", { [key]: value })
      toast.success(
        value ? "Payment method activated." : "Payment method deactivated.",
      )
      onSaved()
    } catch (err) {
      apply(previous)
      toast.error((err as Error).message)
    } finally {
      setPendingKey(null)
    }
  }

  return (
    <PanelCard
      title="Payments"
      description="Activate the methods customers can use at checkout"
    >
      {anyLive && (
        <div className="flex items-start gap-2.5 rounded-lg border border-warning/40 bg-warning/12 px-3 py-2.5 text-warning">
          <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" />
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium">Live payment mode is active</span>
            <span className="text-xs">
              Stripe or PayPal is in live mode. Online charges will move real
              money until you switch back to test/sandbox.
            </span>
          </div>
        </div>
      )}

      {noneEnabled && (
        <div className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
          <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" />
          <span>
            All payment methods are off. Customers will not be able to complete
            checkout until at least one method is activated.
          </span>
        </div>
      )}

      <MethodRow
        title="Stripe"
        description="Card payments and deposit collection"
        enabled={stripeEnabled}
        pending={pendingKey === "stripeEnabled"}
        onToggle={(next) =>
          void updateMethod("stripeEnabled", next, setStripeEnabled)
        }
        trailing={<ModeBadge mode={settings.stripeMode} />}
      />

      {stripeEnabled && (
        <StripeConfig settings={settings} onSaved={onSaved} />
      )}

      <MethodRow
        title="PayPal"
        description="PayPal and wallet payments"
        enabled={paypalEnabled}
        pending={pendingKey === "paypalEnabled"}
        onToggle={(next) =>
          void updateMethod("paypalEnabled", next, setPaypalEnabled)
        }
        trailing={<ModeBadge mode={settings.paypalMode} testLabel="Sandbox" />}
      />

      {paypalEnabled && (
        <PaypalConfig settings={settings} onSaved={onSaved} />
      )}

      <MethodRow
        title="Cash on arrival"
        description="Confirm the booking now; customer pays the driver in cash"
        enabled={cashOnArrivalEnabled}
        pending={pendingKey === "cashOnArrivalEnabled"}
        onToggle={(next) =>
          void updateMethod(
            "cashOnArrivalEnabled",
            next,
            setCashOnArrivalEnabled,
          )
        }
        trailing={
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <BanknoteIcon className="size-3.5" />
            No online deposit
          </span>
        }
      />

      {anyOnline && (
        <div className="mt-2 flex flex-col gap-3 rounded-lg border bg-muted/20 px-3.5 py-4">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-sm font-medium">Amount to collect online</span>
            <span className="text-xs text-muted-foreground">
              Choose what customers can pay at checkout. The deposit share is set
              by “Deposit percentage” in General settings.
            </span>
          </div>

          {noAmountOption && (
            <div className="flex items-start gap-2.5 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" />
              <span>
                Both amount options are off. Enable at least one so customers can
                pay online.
              </span>
            </div>
          )}

          <MethodRow
            title="Deposit payment"
            description={`Collect a ${settings.depositPercentage}% deposit now; balance due later`}
            enabled={depositPaymentEnabled}
            pending={pendingKey === "depositPaymentEnabled"}
            onToggle={(next) =>
              void updateMethod(
                "depositPaymentEnabled",
                next,
                setDepositPaymentEnabled,
              )
            }
          />

          <MethodRow
            title="Full payment"
            description="Let customers pay the full trip price upfront"
            enabled={fullPaymentEnabled}
            pending={pendingKey === "fullPaymentEnabled"}
            onToggle={(next) =>
              void updateMethod(
                "fullPaymentEnabled",
                next,
                setFullPaymentEnabled,
              )
            }
          />
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Stripe and PayPal can each be switched between Test/Sandbox and Live
        below. Secrets are write-only — leave blank to keep the saved value.
      </p>
    </PanelCard>
  )
}

function StripeConfig({
  settings,
  onSaved,
}: {
  settings: Settings
  onSaved: () => void
}) {
  const [mode, setMode] = React.useState<PaymentMode>(settings.stripeMode)
  const [testPublishableKey, setTestPublishableKey] = React.useState(
    settings.stripeTestPublishableKey,
  )
  const [livePublishableKey, setLivePublishableKey] = React.useState(
    settings.stripeLivePublishableKey,
  )
  const [secretKey, setSecretKey] = React.useState("")
  const [webhookSecret, setWebhookSecret] = React.useState("")
  const [pending, setPending] = React.useState(false)

  React.useEffect(() => {
    setMode(settings.stripeMode)
    setTestPublishableKey(settings.stripeTestPublishableKey)
    setLivePublishableKey(settings.stripeLivePublishableKey)
    setSecretKey("")
    setWebhookSecret("")
  }, [
    settings.stripeMode,
    settings.stripeTestPublishableKey,
    settings.stripeLivePublishableKey,
  ])

  const isLive = mode === "live"
  const publishableKey = isLive ? livePublishableKey : testPublishableKey
  const setPublishableKey = isLive
    ? setLivePublishableKey
    : setTestPublishableKey
  const secretSet = isLive
    ? settings.stripeLiveSecretKeySet
    : settings.stripeTestSecretKeySet
  const webhookSet = isLive
    ? settings.stripeLiveWebhookSecretSet
    : settings.stripeTestWebhookSecretSet
  const configured =
    Boolean(publishableKey.trim()) && (secretSet || secretKey.trim())

  async function changeMode(nextLive: boolean) {
    const nextMode: PaymentMode = nextLive ? "live" : "test"
    const previous = mode
    setMode(nextMode)
    try {
      await apiPatch("/api/admin/settings", { stripeMode: nextMode })
      toast.success(
        nextLive ? "Stripe switched to Live." : "Stripe switched to Test.",
      )
      onSaved()
    } catch (err) {
      setMode(previous)
      toast.error((err as Error).message)
    }
  }

  async function saveCredentials() {
    setPending(true)
    try {
      const payload: Record<string, string> = { stripeMode: mode }
      if (isLive) {
        payload.stripeLivePublishableKey = livePublishableKey.trim()
        if (secretKey.trim()) payload.stripeLiveSecretKey = secretKey.trim()
        if (webhookSecret.trim()) {
          payload.stripeLiveWebhookSecret = webhookSecret.trim()
        }
      } else {
        payload.stripeTestPublishableKey = testPublishableKey.trim()
        if (secretKey.trim()) payload.stripeTestSecretKey = secretKey.trim()
        if (webhookSecret.trim()) {
          payload.stripeTestWebhookSecret = webhookSecret.trim()
        }
      }
      await apiPatch("/api/admin/settings", payload)
      toast.success("Stripe credentials saved.")
      setSecretKey("")
      setWebhookSecret("")
      onSaved()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border bg-muted/20 px-3.5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-sm font-medium">Stripe configuration</span>
          <span className="text-xs text-muted-foreground">
            Choose the environment and enter its API keys from the Stripe
            Dashboard.
          </span>
        </div>
        <div className="flex items-center gap-2.5">
          <span className="text-xs text-muted-foreground">Test</span>
          <Switch
            checked={isLive}
            onCheckedChange={(next) => void changeMode(next)}
            aria-label="Toggle Stripe live mode"
          />
          <span className="text-xs font-medium text-warning">Live</span>
        </div>
      </div>

      {isLive && (
        <div className="flex items-start gap-2.5 rounded-md border border-warning/40 bg-warning/12 px-3 py-2 text-warning">
          <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" />
          <span className="text-xs">
            Live mode charges real money. Use your production Stripe keys
            (pk_live_ / sk_live_).
          </span>
        </div>
      )}

      <Field
        label={`${isLive ? "Live" : "Test"} publishable key`}
        htmlFor="stripePublishableKey"
        hint="Starts with pk_test_ or pk_live_."
      >
        <Input
          id="stripePublishableKey"
          value={publishableKey}
          onChange={(e) => setPublishableKey(e.target.value)}
          placeholder="pk_test_..."
          autoComplete="off"
          spellCheck={false}
        />
      </Field>

      <Field
        label={`${isLive ? "Live" : "Test"} secret key`}
        htmlFor="stripeSecretKey"
        hint={
          secretSet
            ? "A secret key is saved. Leave blank to keep it, or enter a new one to replace."
            : "Starts with sk_test_ or sk_live_."
        }
      >
        <Input
          id="stripeSecretKey"
          type="password"
          value={secretKey}
          onChange={(e) => setSecretKey(e.target.value)}
          placeholder={secretSet ? "•••••••• (saved)" : "sk_test_..."}
          autoComplete="off"
          spellCheck={false}
        />
      </Field>

      <Field
        label={`${isLive ? "Live" : "Test"} webhook secret`}
        htmlFor="stripeWebhookSecret"
        hint={
          webhookSet
            ? "A webhook secret is saved. Leave blank to keep it."
            : "Optional. Starts with whsec_ — required for Stripe webhooks."
        }
      >
        <Input
          id="stripeWebhookSecret"
          type="password"
          value={webhookSecret}
          onChange={(e) => setWebhookSecret(e.target.value)}
          placeholder={webhookSet ? "•••••••• (saved)" : "whsec_..."}
          autoComplete="off"
          spellCheck={false}
        />
      </Field>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs">
          {configured ? (
            <>
              <CheckCircle2Icon className="size-3.5 text-success" />
              <span className="text-muted-foreground">
                {isLive ? "Live" : "Test"} credentials configured
              </span>
            </>
          ) : (
            <>
              <AlertTriangleIcon className="size-3.5 text-warning" />
              <span className="text-muted-foreground">
                {isLive ? "Live" : "Test"} not fully configured
              </span>
            </>
          )}
        </span>
        <Button size="sm" onClick={() => void saveCredentials()} disabled={pending}>
          {pending ? "Saving…" : "Save Stripe credentials"}
        </Button>
      </div>
    </div>
  )
}

function PaypalConfig({
  settings,
  onSaved,
}: {
  settings: Settings
  onSaved: () => void
}) {
  const [mode, setMode] = React.useState<PaymentMode>(settings.paypalMode)
  const [sandboxClientId, setSandboxClientId] = React.useState(
    settings.paypalSandboxClientId,
  )
  const [liveClientId, setLiveClientId] = React.useState(
    settings.paypalLiveClientId,
  )
  const [secret, setSecret] = React.useState("")
  const [pending, setPending] = React.useState(false)

  React.useEffect(() => {
    setMode(settings.paypalMode)
    setSandboxClientId(settings.paypalSandboxClientId)
    setLiveClientId(settings.paypalLiveClientId)
    setSecret("")
  }, [
    settings.paypalMode,
    settings.paypalSandboxClientId,
    settings.paypalLiveClientId,
  ])

  const isLive = mode === "live"
  const clientId = isLive ? liveClientId : sandboxClientId
  const setClientId = isLive ? setLiveClientId : setSandboxClientId
  const secretSet = isLive
    ? settings.paypalLiveSecretSet
    : settings.paypalSandboxSecretSet
  const configured = Boolean(clientId.trim()) && (secretSet || secret.trim())

  async function changeMode(nextLive: boolean) {
    const nextMode: PaymentMode = nextLive ? "live" : "test"
    const previous = mode
    setMode(nextMode)
    try {
      await apiPatch("/api/admin/settings", { paypalMode: nextMode })
      toast.success(
        nextLive ? "PayPal switched to Live." : "PayPal switched to Sandbox.",
      )
      onSaved()
    } catch (err) {
      setMode(previous)
      toast.error((err as Error).message)
    }
  }

  async function saveCredentials() {
    setPending(true)
    try {
      const payload: Record<string, string> = { paypalMode: mode }
      if (isLive) {
        payload.paypalLiveClientId = liveClientId.trim()
        if (secret.trim()) payload.paypalLiveSecret = secret.trim()
      } else {
        payload.paypalSandboxClientId = sandboxClientId.trim()
        if (secret.trim()) payload.paypalSandboxSecret = secret.trim()
      }
      await apiPatch("/api/admin/settings", payload)
      toast.success("PayPal credentials saved.")
      setSecret("")
      onSaved()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border bg-muted/20 px-3.5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-sm font-medium">PayPal configuration</span>
          <span className="text-xs text-muted-foreground">
            Choose the environment and enter its API credentials.
          </span>
        </div>
        <div className="flex items-center gap-2.5">
          <span className="text-xs text-muted-foreground">Sandbox</span>
          <Switch
            checked={isLive}
            onCheckedChange={(next) => void changeMode(next)}
            aria-label="Toggle PayPal live mode"
          />
          <span className="text-xs font-medium text-warning">Live</span>
        </div>
      </div>

      {isLive && (
        <div className="flex items-start gap-2.5 rounded-md border border-warning/40 bg-warning/12 px-3 py-2 text-warning">
          <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" />
          <span className="text-xs">
            Live mode charges real money. Make sure these are your production
            PayPal REST app credentials.
          </span>
        </div>
      )}

      <Field
        label={`${isLive ? "Live" : "Sandbox"} client ID`}
        htmlFor="paypalClientId"
      >
        <Input
          id="paypalClientId"
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          placeholder="AeA1QIZ...client id"
          autoComplete="off"
          spellCheck={false}
        />
      </Field>

      <Field
        label={`${isLive ? "Live" : "Sandbox"} secret`}
        htmlFor="paypalSecret"
        hint={
          secretSet
            ? "A secret is saved. Leave blank to keep it, or enter a new one to replace."
            : "Enter the secret from your PayPal REST app."
        }
      >
        <Input
          id="paypalSecret"
          type="password"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          placeholder={secretSet ? "•••••••• (saved)" : "Enter secret"}
          autoComplete="off"
          spellCheck={false}
        />
      </Field>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs">
          {configured ? (
            <>
              <CheckCircle2Icon className="size-3.5 text-success" />
              <span className="text-muted-foreground">
                {isLive ? "Live" : "Sandbox"} credentials configured
              </span>
            </>
          ) : (
            <>
              <AlertTriangleIcon className="size-3.5 text-warning" />
              <span className="text-muted-foreground">
                {isLive ? "Live" : "Sandbox"} not fully configured
              </span>
            </>
          )}
        </span>
        <Button size="sm" onClick={() => void saveCredentials()} disabled={pending}>
          {pending ? "Saving…" : "Save PayPal credentials"}
        </Button>
      </div>
    </div>
  )
}
