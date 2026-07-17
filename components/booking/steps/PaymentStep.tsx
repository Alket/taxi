"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js"
import { loadStripe, type Stripe } from "@stripe/stripe-js"
import { Loader2Icon } from "lucide-react"
import useSWR from "swr"

import { apiPost, fetcher } from "@/lib/api"
import { navigateToBookingConfirmation } from "@/lib/navigate-to-confirmation"
import { normalizePaymentOption } from "@/lib/payment-options"
import type { PaymentOption } from "@/lib/types"
import { createPublicBookingOnce } from "@/lib/public-booking-create"
import {
  isPickupTooSoon,
  pickupLeadTimeMessage,
} from "@/lib/pickup-lead-time"
import { formatDateTime, formatMoney } from "@/lib/format"
import { bypassBookingLeaveGuard } from "@/hooks/use-booking-leave-guard"
import { useBookingStore } from "@/lib/store/booking-store"
import { getVehicleCatalog, round2 } from "@/lib/vehicles"
import { cn } from "@/lib/utils"
import {
  buildBookingStripeAppearance,
  STRIPE_BRAND_FONTS,
} from "@/lib/stripe-appearance"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"

type PublicSettings = {
  depositPercentage?: number
  freeCancellationHours?: number
  stripeEnabled?: boolean
  paypalEnabled?: boolean
  cashOnArrivalEnabled?: boolean
  depositPaymentEnabled?: boolean
  fullPaymentEnabled?: boolean
}

type CreateBookingResponse = {
  bookingId: string
  referenceCode: string
  depositAmount: number
  totalPrice: number
  balanceDue: number
  currency: string
  freeCancellationUntil: string
  freeCancellationHours: number
}

type CreateIntentResponse = {
  clientSecret: string
  paymentIntentId: string
  depositAmount: number
  chargeAmount?: number
  paymentOption?: PaymentOption
  currency: string
  bookingId: string
  referenceCode: string
  publishableKey: string | null
}

let stripePromise: Promise<Stripe | null> | null = null

function getStripePromise(publishableKey: string) {
  if (!stripePromise) {
    stripePromise = loadStripe(publishableKey)
  }
  return stripePromise
}

function Recap() {
  const direction = useBookingStore((s) => s.direction)
  const pickup = useBookingStore((s) => s.pickup)
  const dropoff = useBookingStore((s) => s.dropoff)
  const pickupDateTime = useBookingStore((s) => s.pickupDateTime)
  const returnDateTime = useBookingStore((s) => s.returnDateTime)
  const flightNumber = useBookingStore((s) => s.flightNumber)
  const vehicleType = useBookingStore((s) => s.vehicleType)
  const passengerCount = useBookingStore((s) => s.passengerCount)
  const luggageCount = useBookingStore((s) => s.luggageCount)
  const infantCarrierCount = useBookingStore((s) => s.infantCarrierCount)
  const childSeatCount = useBookingStore((s) => s.childSeatCount)
  const boosterCount = useBookingStore((s) => s.boosterCount)
  const isRoundTrip = useBookingStore((s) => s.isRoundTrip)
  const meetAndGreet = useBookingStore((s) => s.meetAndGreet)
  const customer = useBookingStore((s) => s.customer)

  const vehicle = vehicleType ? getVehicleCatalog(vehicleType) : null
  const seatParts = [
    infantCarrierCount > 0 ? `Infant carrier ×${infantCarrierCount}` : null,
    childSeatCount > 0 ? `Child seat ×${childSeatCount}` : null,
    boosterCount > 0 ? `Booster ×${boosterCount}` : null,
  ].filter(Boolean)

  return (
    <div className="rounded-xl border bg-muted/20 p-4 text-sm">
      <h3 className="text-sm font-bold text-brand">Trip recap</h3>
      <dl className="mt-3 grid gap-2.5">
        <RecapRow
          label="Route"
          value={`${pickup.address} → ${dropoff.address}`}
        />
        <RecapRow
          label="Direction"
          value={
            direction === "airport_to_dest"
              ? "Airport → Destination"
              : "Destination → Airport"
          }
        />
        <RecapRow
          label="Pickup"
          value={pickupDateTime ? formatDateTime(pickupDateTime) : "—"}
        />
        {isRoundTrip && (
          <RecapRow
            label="Return"
            value={returnDateTime ? formatDateTime(returnDateTime) : "—"}
          />
        )}
        {flightNumber && <RecapRow label="Flight" value={flightNumber} />}
        <RecapRow
          label="Vehicle"
          value={`${vehicle?.label ?? vehicleType}${meetAndGreet ? " · Meet & greet" : ""}`}
        />
        <RecapRow
          label="Party"
          value={`${passengerCount} passenger${passengerCount === 1 ? "" : "s"}, ${luggageCount} bag${luggageCount === 1 ? "" : "s"}`}
        />
        {seatParts.length > 0 && (
          <RecapRow label="Child seats" value={seatParts.join(" · ")} />
        )}
        <RecapRow label="Contact" value={`${customer.name} · ${customer.email}`} />
      </dl>
    </div>
  )
}

function RecapRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-0.5 sm:grid-cols-[7rem_1fr] sm:gap-3">
      <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="min-w-0 break-words text-brand">{value}</dd>
    </div>
  )
}

function PaymentOptionCard({
  active,
  disabled,
  title,
  amount,
  hint,
  onSelect,
}: {
  active: boolean
  disabled?: boolean
  title: string
  amount: string
  hint: string
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={active}
      className={cn(
        "flex flex-col items-start gap-0.5 rounded-lg border px-3.5 py-3 text-left transition-colors",
        active
          ? "border-brand-accent bg-brand-accent/5 ring-1 ring-brand-accent"
          : "hover:bg-muted/50",
        disabled && "cursor-not-allowed opacity-60",
      )}
    >
      <span className="text-sm font-semibold text-brand">{title}</span>
      <span className="text-lg font-semibold tabular-nums">{amount}</span>
      <span className="text-xs text-muted-foreground">{hint}</span>
    </button>
  )
}

function StripeCheckoutForm({
  depositAmount,
  paymentOption,
  currency,
  bookingId,
  referenceCode,
  paymentIntentId,
  termsAccepted,
  paymentLayout,
}: {
  depositAmount: number
  paymentOption: PaymentOption
  currency: string
  bookingId: string
  referenceCode: string
  paymentIntentId: string
  termsAccepted: boolean
  paymentLayout: "tabs" | "accordion"
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function onPay(e: React.FormEvent) {
    e.preventDefault()
    if (!stripe || !elements || !termsAccepted) return

    setSubmitting(true)
    setError(null)

    try {
      const result = await stripe.confirmPayment({
        elements,
        redirect: "if_required",
        confirmParams: {
          return_url: `${window.location.origin}/book/confirmation/${referenceCode}`,
        },
      })

      if (result.error) {
        const code = result.error.code
        if (code === "card_declined") {
          setError("Your card was declined. Try another card or PayPal.")
        } else if (code === "expired_card") {
          setError("Your card has expired. Try another card.")
        } else {
          setError(result.error.message || "Payment failed. Please try again.")
        }
        return
      }

      const intent = result.paymentIntent
      if (intent?.status === "succeeded") {
        await apiPost("/api/payments/confirm-deposit", {
          bookingId,
          paymentIntentId: intent.id || paymentIntentId,
        })
        navigateToBookingConfirmation(referenceCode)
        return
      }

      setError("Payment is still processing. Please wait a moment and try again.")
    } catch (err) {
      setError(
        (err as Error).message ||
          "Network error while processing payment. Check your connection and retry.",
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={onPay} className="flex min-w-0 flex-col gap-5">
      <div className="min-w-0 overflow-x-auto [-webkit-overflow-scrolling:touch]">
        <PaymentElement
          key={paymentLayout}
          className="stripe-booking-payment"
          options={{
            layout:
              paymentLayout === "accordion"
                ? {
                    type: "accordion",
                    defaultCollapsed: false,
                    spacedAccordionItems: true,
                  }
                : {
                    type: "tabs",
                    defaultCollapsed: false,
                  },
            paymentMethodOrder: ["card"],
            terms: {
              card: "never",
            },
          }}
        />
      </div>
      {error && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm font-bold text-destructive">
          {error}
        </p>
      )}
      <Button
        type="submit"
        size="lg"
        className="h-12 w-full rounded-lg text-base font-extrabold bg-brand-accent text-white hover:bg-brand-accent-hover"
        disabled={!stripe || !elements || submitting || !termsAccepted}
      >
        {submitting ? (
          <>
            <Loader2Icon className="animate-spin" data-icon="inline-start" />
            Processing…
          </>
        ) : paymentOption === "full" ? (
          `Pay ${formatMoney(depositAmount, currency)} now`
        ) : (
          `Pay deposit of ${formatMoney(depositAmount, currency)} now`
        )}
      </Button>
    </form>
  )
}

export function PaymentStep() {
  const router = useRouter()
  const store = useBookingStore()
  const patch = useBookingStore((s) => s.patch)

  const { data: settings } = useSWR<PublicSettings>(
    "/api/settings/public",
    fetcher,
  )

  const [bootError, setBootError] = React.useState<string | null>(null)
  const [booting, setBooting] = React.useState(true)
  const [intent, setIntent] = React.useState<CreateIntentResponse | null>(null)
  const [paymentOption, setPaymentOption] =
    React.useState<PaymentOption>("deposit")
  const [switchingIntent, setSwitchingIntent] = React.useState(false)
  const intentOptionRef = React.useRef<PaymentOption | null>(null)
  const [termsAccepted, setTermsAccepted] = React.useState(false)
  const [paypalPending, setPaypalPending] = React.useState(false)
  const [paypalError, setPaypalError] = React.useState<string | null>(null)
  const [cashPending, setCashPending] = React.useState(false)
  const [cashError, setCashError] = React.useState<string | null>(null)
  const [paymentLayout, setPaymentLayout] = React.useState<"tabs" | "accordion">(
    "tabs",
  )

  React.useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)")
    const apply = () =>
      setPaymentLayout(mq.matches ? "accordion" : "tabs")
    apply()
    mq.addEventListener("change", apply)
    return () => mq.removeEventListener("change", apply)
  }, [])

  const freeCancellationHours =
    settings?.freeCancellationHours ?? 24
  const depositPercentage = settings?.depositPercentage ?? 30
  const stripeEnabled = settings?.stripeEnabled ?? true
  const paypalEnabled = settings?.paypalEnabled ?? true
  const cashOnArrivalEnabled = settings?.cashOnArrivalEnabled ?? false
  const depositPaymentEnabled = settings?.depositPaymentEnabled ?? true
  const fullPaymentEnabled = settings?.fullPaymentEnabled ?? true

  // Create pending booking, then Stripe intent only if card payments are on.
  React.useEffect(() => {
    let cancelled = false

    async function boot() {
      setBooting(true)
      setBootError(null)

      try {
        let bookingId = store.createdBookingId
        let referenceCode = store.createdReferenceCode
        let depositAmount = store.createdDepositAmount
        let currency = store.createdCurrency

        if (!bookingId) {
          if (
            !store.direction ||
            !store.vehicleType ||
            !store.pickupDateTime ||
            store.pickup.lat == null ||
            store.dropoff.lat == null
          ) {
            throw new Error("Booking details are incomplete.")
          }
          if (isPickupTooSoon(store.pickupDateTime)) {
            throw new Error(pickupLeadTimeMessage())
          }

          // Deduplicate: React Strict Mode (and remounts) can run this effect
          // twice before createdBookingId is written — without this lock you get
          // two pending bookings and only one gets confirmed at payment.
          const created = await createPublicBookingOnce(() =>
            apiPost<CreateBookingResponse>("/api/bookings", {
              customer: store.customer,
              direction: store.direction,
              pickupAddress: store.pickup.address,
              pickupLat: store.pickup.lat,
              pickupLng: store.pickup.lng,
              dropoffAddress: store.dropoff.address,
              dropoffLat: store.dropoff.lat,
              dropoffLng: store.dropoff.lng,
              pickupDateTime: store.pickupDateTime,
              returnDateTime: store.returnDateTime,
              flightNumber: store.flightNumber || null,
              passengerCount: store.passengerCount,
              luggageCount: store.luggageCount,
              infantCarrierCount: store.infantCarrierCount,
              childSeatCount: store.childSeatCount,
              boosterCount: store.boosterCount,
              driverNotes: store.driverNotes.trim() || null,
              vehicleType: store.vehicleType,
              isRoundTrip: store.isRoundTrip,
              meetAndGreet: store.meetAndGreet,
            }),
          )

          bookingId = created.bookingId
          referenceCode = created.referenceCode
          depositAmount = created.depositAmount
          currency = created.currency

          if (!cancelled) {
            patch({
              createdBookingId: bookingId,
              createdReferenceCode: referenceCode,
              createdDepositAmount: depositAmount,
              createdCurrency: currency,
              quotedPrice: created.totalPrice,
            })
          }
        }

        // Wait for public settings so we know which methods are active.
        const publicSettings = await fetcher<PublicSettings>(
          "/api/settings/public",
        )
        const allowStripe = publicSettings.stripeEnabled ?? true
        const allowPaypal = publicSettings.paypalEnabled ?? true
        const allowCash = publicSettings.cashOnArrivalEnabled ?? false
        const depositOpt = publicSettings.depositPaymentEnabled ?? true
        const fullOpt = publicSettings.fullPaymentEnabled ?? true

        if (!allowStripe && !allowPaypal && !allowCash) {
          throw new Error(
            "No payment methods are available right now. Please contact support.",
          )
        }

        const initialOption = normalizePaymentOption(
          depositOpt ? "deposit" : "full",
          { depositEnabled: depositOpt, fullEnabled: fullOpt },
        )
        if (!cancelled) setPaymentOption(initialOption)

        if (allowStripe) {
          try {
            const intentRes = await apiPost<CreateIntentResponse>(
              "/api/payments/create-intent",
              { bookingId, paymentOption: initialOption },
            )

            if (!cancelled) {
              setIntent(intentRes)
              intentOptionRef.current = intentRes.paymentOption ?? initialOption
              patch({
                createdCurrency: intentRes.currency,
                createdReferenceCode: intentRes.referenceCode,
              })
            }
          } catch (stripeErr) {
            // Fall through to PayPal / cash if card setup fails.
            if (!allowPaypal && !allowCash) throw stripeErr
            if (!cancelled) setIntent(null)
          }
        } else if (!cancelled) {
          setIntent(null)
        }
      } catch (err) {
        if (!cancelled) {
          const error = err as Error & { code?: string }
          if (error.code === "SESSION_EXPIRED") {
            setBootError(
              "This payment session has expired. Go back and create a new booking.",
            )
            patch({
              createdBookingId: null,
              createdReferenceCode: null,
              createdDepositAmount: null,
              createdCurrency: null,
            })
          } else {
            setBootError(error.message || "Could not start payment.")
          }
        }
      } finally {
        if (!cancelled) setBooting(false)
      }
    }

    void boot()
    return () => {
      cancelled = true
    }
    // Intentionally run once when entering the payment step.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Recreate the Stripe intent with the right amount when the customer switches
  // between paying a deposit and the full amount.
  React.useEffect(() => {
    const bookingId = store.createdBookingId
    if (!bookingId || !stripeEnabled) return
    if (intentOptionRef.current === null) return
    if (intentOptionRef.current === paymentOption) return

    let cancelled = false
    setSwitchingIntent(true)
    void (async () => {
      try {
        const intentRes = await apiPost<CreateIntentResponse>(
          "/api/payments/create-intent",
          { bookingId, paymentOption },
        )
        if (!cancelled) {
          setIntent(intentRes)
          intentOptionRef.current = intentRes.paymentOption ?? paymentOption
        }
      } catch {
        // Revert the selection so the shown amount matches the live intent.
        if (!cancelled && intentOptionRef.current) {
          setPaymentOption(intentOptionRef.current)
        }
      } finally {
        if (!cancelled) setSwitchingIntent(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [paymentOption, stripeEnabled, store.createdBookingId])

  async function payWithPaypal() {
    if (!store.createdBookingId || !termsAccepted) return
    setPaypalPending(true)
    setPaypalError(null)
    try {
      const res = await apiPost<{ approveUrl: string }>(
        "/api/payments/paypal/create-order",
        { bookingId: store.createdBookingId, paymentOption },
      )
      bypassBookingLeaveGuard()
      window.location.href = res.approveUrl
    } catch (err) {
      const error = err as Error & { code?: string }
      if (error.code === "PAYPAL_UNAVAILABLE" || error.code === "METHOD_DISABLED") {
        setPaypalError("PayPal is not available right now.")
      } else if (error.code === "SESSION_EXPIRED") {
        setPaypalError("This payment session has expired. Please start again.")
      } else {
        setPaypalError(error.message || "Could not start PayPal checkout.")
      }
      setPaypalPending(false)
    }
  }

  async function confirmCashOnArrival() {
    if (!store.createdBookingId || !termsAccepted) return
    setCashPending(true)
    setCashError(null)
    try {
      const res = await apiPost<{ referenceCode: string }>(
        "/api/payments/cash-on-arrival",
        { bookingId: store.createdBookingId },
      )
      navigateToBookingConfirmation(res.referenceCode)
    } catch (err) {
      const error = err as Error & { code?: string }
      if (error.code === "METHOD_DISABLED") {
        setCashError("Cash on arrival is not available right now.")
      } else if (error.code === "SESSION_EXPIRED") {
        setCashError("This session has expired. Please start again.")
      } else {
        setCashError(error.message || "Could not confirm cash booking.")
      }
      setCashPending(false)
    }
  }

  if (booting) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2Icon className="size-4 animate-spin" />
          Preparing checkout…
        </div>
      </div>
    )
  }

  if (bootError || !store.createdBookingId) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
        <p className="font-medium text-destructive">Payment unavailable</p>
        <p className="mt-1 text-muted-foreground">
          {bootError || "Could not start checkout."}
        </p>
        <Button
          type="button"
          variant="outline"
          className="mt-3"
          onClick={() => router.push("/")}
        >
          Start over
        </Button>
      </div>
    )
  }

  const publishableKey =
    intent?.publishableKey || process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  const showStripe = stripeEnabled && Boolean(intent && publishableKey)
  const showPaypal = paypalEnabled
  const showCash = cashOnArrivalEnabled
  const anyOnlineMethod = showStripe || showPaypal

  if (stripeEnabled && !intent && !showPaypal && !showCash) {
    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
        Card payments could not be initialized. Check Stripe configuration or
        enable another payment method in admin settings.
      </div>
    )
  }

  if (!showStripe && !showPaypal && !showCash) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
        <p className="font-medium text-destructive">No payment methods available</p>
        <p className="mt-1 text-muted-foreground">
          Please contact support to complete your booking.
        </p>
      </div>
    )
  }

  const currency = intent?.currency ?? store.createdCurrency ?? "EUR"
  const depositValue = store.createdDepositAmount ?? 0
  const tripTotal = store.quotedPrice ?? depositValue
  const chargeNow = paymentOption === "full" ? tripTotal : depositValue
  const balanceDue = round2(Math.max(0, tripTotal - chargeNow))
  const referenceCode =
    intent?.referenceCode ?? store.createdReferenceCode ?? ""
  const showPaymentOptionSelector =
    anyOnlineMethod && depositPaymentEnabled && fullPaymentEnabled

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <Recap />

      <div className="rounded-xl border p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              {anyOnlineMethod
                ? paymentOption === "full"
                  ? "Full amount due now"
                  : "Deposit due now"
                : "Amount due on arrival"}
            </p>
            <p className="text-2xl font-semibold tabular-nums">
              {formatMoney(anyOnlineMethod ? chargeNow : tripTotal, currency)}
            </p>
          </div>
          <div className="text-xs text-muted-foreground sm:text-right">
            <p>Trip total {formatMoney(tripTotal, currency)}</p>
            {anyOnlineMethod && balanceDue > 0 && (
              <p>Balance later {formatMoney(balanceDue, currency)}</p>
            )}
            {anyOnlineMethod && balanceDue <= 0 && (
              <p>Nothing left to pay after checkout</p>
            )}
          </div>
        </div>

        {showPaymentOptionSelector && (
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <PaymentOptionCard
              active={paymentOption === "deposit"}
              disabled={switchingIntent || paypalPending}
              title="Pay deposit now"
              amount={formatMoney(depositValue, currency)}
              hint={`Pay ${formatMoney(
                Math.max(0, round2(tripTotal - depositValue)),
                currency,
              )} balance later`}
              onSelect={() => setPaymentOption("deposit")}
            />
            <PaymentOptionCard
              active={paymentOption === "full"}
              disabled={switchingIntent || paypalPending}
              title="Pay full amount"
              amount={formatMoney(tripTotal, currency)}
              hint="Nothing to pay at pickup"
              onSelect={() => setPaymentOption("full")}
            />
          </div>
        )}
        {switchingIntent && (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2Icon className="size-3 animate-spin" />
            Updating amount…
          </p>
        )}
      </div>

      <label className="flex items-start gap-3 rounded-xl border px-3.5 py-3 text-sm">
        <input
          type="checkbox"
          className="mt-0.5 size-4 shrink-0 rounded border-input accent-brand-accent"
          checked={termsAccepted}
          onChange={(e) => setTermsAccepted(e.target.checked)}
        />
        <span className="min-w-0">
          I agree to the booking terms and cancellation policy. Free
          cancellation until{" "}
          <span className="font-medium text-brand">
            {freeCancellationHours} hours
          </span>{" "}
          before pickup
          {store.pickupDateTime
            ? ` (until ${formatDateTime(
                new Date(
                  new Date(store.pickupDateTime).getTime() -
                    freeCancellationHours * 60 * 60 * 1000,
                ).toISOString(),
              )})`
            : ""}
          .
        </span>
      </label>

      {showStripe && intent && publishableKey && (
        <div
          className={cn(
            "flex min-w-0 flex-col gap-3 rounded-xl border border-border bg-brand-surface p-4",
            !termsAccepted && "opacity-70",
          )}
        >
          <div className="flex flex-col gap-1">
            <Label className="text-sm font-extrabold text-brand">
              Card payment
            </Label>
            <p className="text-xs font-semibold text-muted-foreground">
              Pay securely with your debit or credit card.
            </p>
          </div>
          <Elements
            key={intent.clientSecret}
            stripe={getStripePromise(publishableKey)}
            options={{
              clientSecret: intent.clientSecret,
              appearance: buildBookingStripeAppearance(),
              fonts: [...STRIPE_BRAND_FONTS],
              loader: "auto",
            }}
          >
            <StripeCheckoutForm
              depositAmount={chargeNow}
              paymentOption={paymentOption}
              currency={currency}
              bookingId={intent.bookingId}
              referenceCode={intent.referenceCode}
              paymentIntentId={intent.paymentIntentId}
              termsAccepted={termsAccepted && !switchingIntent}
              paymentLayout={paymentLayout}
            />
          </Elements>
        </div>
      )}

      {showStripe && showPaypal && (
        <div className="relative flex items-center gap-3">
          <Separator className="flex-1" />
          <span className="text-xs text-muted-foreground">or</span>
          <Separator className="flex-1" />
        </div>
      )}

      {showPaypal && (
        <div className="flex flex-col gap-2">
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="w-full rounded font-bold border-brand-accent text-brand-accent hover:bg-brand-accent/10 hover:text-brand-accent"
            disabled={!termsAccepted || paypalPending || switchingIntent}
            onClick={() => void payWithPaypal()}
          >
            {paypalPending ? (
              <>
                <Loader2Icon className="animate-spin" data-icon="inline-start" />
                Redirecting to PayPal…
              </>
            ) : (
              `Pay with PayPal · ${formatMoney(chargeNow, currency)}`
            )}
          </Button>
          {paypalError && (
            <p className="text-sm text-destructive">{paypalError}</p>
          )}
          <p className="text-xs text-muted-foreground">
            You&apos;ll return here after approving the payment on PayPal.
          </p>
        </div>
      )}

      {(showStripe || showPaypal) && showCash && (
        <div className="relative flex items-center gap-3">
          <Separator className="flex-1" />
          <span className="text-xs text-muted-foreground">or</span>
          <Separator className="flex-1" />
        </div>
      )}

      {showCash && (
        <div className="flex flex-col gap-2">
          <Button
            type="button"
            variant={anyOnlineMethod ? "outline" : "default"}
            size="lg"
            className={cn("w-full rounded font-bold", !anyOnlineMethod && "bg-brand-accent text-white hover:bg-brand-accent-hover")}
            disabled={!termsAccepted || cashPending}
            onClick={() => void confirmCashOnArrival()}
          >
            {cashPending ? (
              <>
                <Loader2Icon className="animate-spin" data-icon="inline-start" />
                Confirming…
              </>
            ) : (
              `Cash on arrival · ${formatMoney(tripTotal, currency)}`
            )}
          </Button>
          {cashError && (
            <p className="text-sm text-destructive">{cashError}</p>
          )}
          <p className="text-xs text-muted-foreground">
            Your trip is reserved now. Pay the full amount to your driver at
            pickup{referenceCode ? ` (ref ${referenceCode})` : ""}.
          </p>
        </div>
      )}
    </div>
  )
}
