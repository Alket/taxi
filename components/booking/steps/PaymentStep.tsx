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
import {
  Loader2Icon,
  CreditCardIcon,
  LockIcon,
  ShieldCheckIcon,
  ChevronDownIcon,
  BanknoteIcon,
  CheckIcon,
  type LucideIcon,
} from "lucide-react"
import useSWR from "swr"
import { toast } from "sonner"

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
import { useBookingFieldFocusListener } from "@/hooks/use-booking-field-focus"
import { focusBookingTerms } from "@/lib/booking-field-focus"
import { useBookingStore } from "@/lib/store/booking-store"
import { getVehicleCatalog, round2 } from "@/lib/vehicles"
import { cn } from "@/lib/utils"
import {
  buildBookingStripeAppearance,
  STRIPE_BRAND_FONTS,
} from "@/lib/stripe-appearance"
import {
  resolvePhoneCountryOption,
  splitPhone,
} from "@/lib/booking-details"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

type PublicSettings = {
  depositPercentage?: number
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

  const [open, setOpen] = React.useState(false)
  const routePreview =
    pickup.address && dropoff.address
      ? `${pickup.address.split(",")[0]} → ${dropoff.address.split(",")[0]}`
      : "View trip details"
  const pickupPreview = pickupDateTime ? formatDateTime(pickupDateTime) : null

  return (
    <div className="rounded-xl border bg-muted/20 text-sm">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-start justify-between gap-3 p-4 text-left md:pointer-events-none md:cursor-default"
      >
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold text-brand">Trip recap</h3>
          <p className="mt-1 truncate text-xs text-muted-foreground md:hidden">
            {routePreview}
            {pickupPreview ? ` · ${pickupPreview}` : ""}
          </p>
        </div>
        <ChevronDownIcon
          className={cn(
            "mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform md:hidden",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>
      <dl
        className={cn(
          "grid gap-2.5 border-t px-4 pb-4 pt-3 md:block",
          open ? "block" : "hidden md:block",
        )}
      >
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

type CheckoutMethod = "card" | "paypal" | "cash"

type CheckoutMethodOption = {
  id: CheckoutMethod
  label: string
  description: string
  icon: LucideIcon
  badge?: string
}

function PaypalMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden
      fill="currentColor"
    >
      <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944 3.72A.77.77 0 0 1 5.705 3h6.826c2.162 0 3.873.51 5.086 1.518 1.16.964 1.747 2.39 1.747 4.24 0 .29-.02.59-.06.9-.41 3.23-2.66 5.17-6.2 5.17h-1.87a.77.77 0 0 0-.76.65l-.78 4.94a.64.64 0 0 1-.63.55l-.988.01z" />
      <path
        d="M18.98 7.15c-.05.32-.11.65-.2.99-.86 4.07-3.7 5.48-7.36 5.48H9.51a.77.77 0 0 0-.76.65l-.94 5.95a.64.64 0 0 1-.63.55H4.15a.32.32 0 0 1-.316-.37l.14-.89"
        opacity="0.7"
      />
    </svg>
  )
}

function PaymentMethodChooser({
  methods,
  value,
  onChange,
  disabled,
}: {
  methods: CheckoutMethodOption[]
  value: CheckoutMethod
  onChange: (method: CheckoutMethod) => void
  disabled?: boolean
}) {
  return (
    <fieldset className="flex flex-col gap-3" disabled={disabled}>
      <legend className="mb-1 text-sm font-bold text-brand">
        Choose payment method
      </legend>
      <div
        className="grid gap-2.5"
        role="radiogroup"
        aria-label="Payment method"
      >
        {methods.map((method) => {
          const active = value === method.id
          const Icon = method.icon
          return (
            <button
              key={method.id}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={disabled}
              onClick={() => onChange(method.id)}
              className={cn(
                "group relative flex w-full items-center gap-3.5 rounded-2xl border px-4 py-3.5 text-left transition-all duration-200",
                active
                  ? "border-brand-accent bg-gradient-to-r from-brand-accent/[0.08] to-transparent shadow-[0_0_0_1px_var(--brand-accent)]"
                  : "border-border bg-brand-surface hover:border-brand-accent/40 hover:bg-muted/40",
                disabled && "cursor-not-allowed opacity-60",
              )}
            >
              <span
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                  active
                    ? "border-brand-accent bg-brand-accent text-white"
                    : "border-muted-foreground/35 bg-brand-surface",
                )}
                aria-hidden
              >
                {active ? <CheckIcon className="size-3" strokeWidth={3} /> : null}
              </span>

              <span
                className={cn(
                  "flex size-11 shrink-0 items-center justify-center rounded-xl transition-colors",
                  active
                    ? "bg-brand-accent text-white"
                    : "bg-brand-page text-brand group-hover:bg-brand-accent/10 group-hover:text-brand-accent",
                )}
                aria-hidden
              >
                {method.id === "paypal" ? (
                  <PaypalMark className="size-5" />
                ) : (
                  <Icon className="size-5" strokeWidth={1.75} />
                )}
              </span>

              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold text-brand">
                    {method.label}
                  </span>
                  {method.badge ? (
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-extrabold tracking-wide uppercase",
                        active
                          ? "bg-brand-accent/15 text-brand-accent"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {method.badge}
                    </span>
                  ) : null}
                </span>
                <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
                  {method.description}
                </span>
              </span>
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}

function stripeBillingCountryFromPhone(phone: string): string {
  const { countryCode } = splitPhone(phone)
  return resolvePhoneCountryOption(countryCode).iso
}

function StripeCheckoutForm({
  depositAmount,
  paymentOption,
  currency,
  bookingId,
  referenceCode,
  paymentIntentId,
  termsAccepted,
  customerName,
  customerEmail,
  customerPhone,
}: {
  depositAmount: number
  paymentOption: PaymentOption
  currency: string
  bookingId: string
  referenceCode: string
  paymentIntentId: string
  termsAccepted: boolean
  customerName: string
  customerEmail: string
  customerPhone: string
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [ready, setReady] = React.useState(false)

  React.useEffect(() => {
    if (termsAccepted) setError(null)
  }, [termsAccepted])

  async function onPay(e: React.FormEvent) {
    e.preventDefault()
    if (!stripe || !elements) return

    if (!termsAccepted) {
      setError("Please agree to the booking terms and cancellation policy to proceed.")
      focusBookingTerms()
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const result = await stripe.confirmPayment({
        elements,
        redirect: "if_required",
        confirmParams: {
          return_url: `${window.location.origin}/book/confirmation/${referenceCode}`,
          // Name/email/phone are opted out on the Element (already collected in booking).
          // Address uses `if_required` so Stripe collects zip/country as needed — do not
          // pass a partial address here or Stripe will demand every omitted field.
          payment_method_data: {
            billing_details: {
              name: customerName || undefined,
              email: customerEmail || undefined,
              phone: customerPhone || undefined,
            },
          },
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
    <form onSubmit={onPay} className="flex min-w-0 flex-col gap-4">
      <div className="relative rounded-xl bg-brand-page p-4">
        {!ready && (
          <div className="absolute inset-x-4 top-4 z-10 flex flex-col gap-4 bg-brand-page py-2">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <Loader2Icon className="size-3.5 animate-spin text-brand-accent" />
                <span>Loading secure checkout...</span>
              </div>
              <Skeleton className="h-12 w-full rounded-xl" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Skeleton className="h-12 w-full rounded-xl" />
              <Skeleton className="h-12 w-full rounded-xl" />
            </div>
          </div>
        )}
        <div
          className={cn(
            "relative transition-opacity duration-300",
            ready ? "opacity-100" : "opacity-0 pointer-events-none",
          )}
        >
          <PaymentElement
            className="stripe-booking-payment"
            onReady={() => setReady(true)}
            options={{
              layout: {
                type: "tabs",
                defaultCollapsed: false,
              },
              paymentMethodOrder: ["card"],
              terms: { card: "never" },
              readOnly: !termsAccepted,
              defaultValues: {
                billingDetails: {
                  name: customerName || undefined,
                  email: customerEmail || undefined,
                  phone: customerPhone || undefined,
                  address: {
                    country: stripeBillingCountryFromPhone(customerPhone),
                  },
                },
              },
              fields: {
                billingDetails: {
                  name: "never",
                  email: "never",
                  phone: "never",
                  // Collect only what the payment method needs (usually country + postal code).
                  // Do not use "never" here — that forces inventing full address at confirm time.
                  address: "if_required",
                },
              },
            }}
          />
          {!termsAccepted ? (
            <button
              type="button"
              className="absolute inset-0 z-20 cursor-not-allowed rounded-xl bg-transparent"
              aria-label="Accept booking terms before entering card details"
              onClick={() => {
                setError(
                  "Please agree to the booking terms and cancellation policy to proceed.",
                )
                focusBookingTerms()
              }}
            />
          ) : null}
        </div>
      </div>
      {error && (
        <p className="text-sm font-semibold text-destructive animate-in fade-in-50 slide-in-from-top-1 duration-200">{error}</p>
      )}
      <Button
        type="submit"
        size="lg"
        className="h-12 w-full rounded-xl bg-brand-accent text-base font-extrabold text-white transition-all hover:bg-brand-accent-hover active:scale-[0.99] shadow-sm flex items-center justify-center gap-2"
        disabled={!stripe || !elements || submitting || !ready || !termsAccepted}
      >
        {submitting ? (
          <>
            <Loader2Icon className="animate-spin" data-icon="inline-start" />
            Processing secure payment…
          </>
        ) : (
          <>
            <LockIcon className="size-4" />
            {paymentOption === "full" ? (
              `Pay ${formatMoney(depositAmount, currency)}`
            ) : (
              `Pay deposit ${formatMoney(depositAmount, currency)}`
            )}
          </>
        )}
      </Button>
      <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
        <ShieldCheckIcon className="size-4 text-brand-accent" />
        <span>PCI-compliant secure bank transfer</span>
      </div>
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
  const [checkoutMethod, setCheckoutMethod] =
    React.useState<CheckoutMethod | null>(null)
  const [paypalPending, setPaypalPending] = React.useState(false)
  const [paypalError, setPaypalError] = React.useState<string | null>(null)
  const [cashPending, setCashPending] = React.useState(false)
  const [cashError, setCashError] = React.useState<string | null>(null)

  useBookingFieldFocusListener("terms")

  const depositPercentage = settings?.depositPercentage ?? 30
  const stripeEnabled = settings?.stripeEnabled ?? true
  const paypalEnabled = settings?.paypalEnabled ?? true
  const cashOnArrivalEnabled = settings?.cashOnArrivalEnabled ?? false
  const depositPaymentEnabled = settings?.depositPaymentEnabled ?? true
  const fullPaymentEnabled = settings?.fullPaymentEnabled ?? true

  const publishableKey =
    intent?.publishableKey || process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  const showStripe = stripeEnabled && Boolean(intent && publishableKey)
  const showPaypal = paypalEnabled
  const showCash = cashOnArrivalEnabled

  const availableMethods = React.useMemo(() => {
    const methods: CheckoutMethodOption[] = []
    if (showStripe) {
      methods.push({
        id: "card",
        label: "Card",
        description: "Visa, Mastercard, Amex — secure checkout",
        icon: CreditCardIcon,
        badge: "Recommended",
      })
    }
    if (showPaypal) {
      methods.push({
        id: "paypal",
        label: "PayPal",
        description: "Pay with your PayPal balance or linked card",
        icon: CreditCardIcon,
      })
    }
    if (showCash) {
      methods.push({
        id: "cash",
        label: "Cash on arrival",
        description: "Reserve now, pay the driver at pickup",
        icon: BanknoteIcon,
      })
    }
    return methods
  }, [showStripe, showPaypal, showCash])

  const selectedMethod =
    checkoutMethod && availableMethods.some((m) => m.id === checkoutMethod)
      ? checkoutMethod
      : (availableMethods[0]?.id ?? null)

  React.useEffect(() => {
    if (!selectedMethod) return
    if (checkoutMethod !== selectedMethod) {
      setCheckoutMethod(selectedMethod)
    }
  }, [checkoutMethod, selectedMethod])

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
            !store.selectedZoneId ||
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
              zoneId: store.selectedZoneId,
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
    if (!store.createdBookingId) return
    if (!termsAccepted) {
      toast.error("Please agree to the booking terms and cancellation policy to proceed.")
      focusBookingTerms()
      return
    }
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
    if (!store.createdBookingId) return
    if (!termsAccepted) {
      toast.error("Please agree to the booking terms and cancellation policy to proceed.")
      focusBookingTerms()
      return
    }
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
  const payingOnline = selectedMethod === "card" || selectedMethod === "paypal"
  const chargeNow = paymentOption === "full" ? tripTotal : depositValue
  const balanceDue = round2(Math.max(0, tripTotal - chargeNow))
  const referenceCode =
    intent?.referenceCode ?? store.createdReferenceCode ?? ""
  const showPaymentOptionSelector =
    payingOnline && depositPaymentEnabled && fullPaymentEnabled
  const showMethodChooser = availableMethods.length > 1

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <Recap />

      <div className="rounded-xl border p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              {payingOnline
                ? paymentOption === "full"
                  ? "Full amount due now"
                  : "Deposit due now"
                : "Amount due on arrival"}
            </p>
            <p className="text-2xl font-semibold tabular-nums">
              {formatMoney(payingOnline ? chargeNow : tripTotal, currency)}
            </p>
          </div>
          <div className="text-xs text-muted-foreground sm:text-right">
            <p>Trip total {formatMoney(tripTotal, currency)}</p>
            {payingOnline && balanceDue > 0 && (
              <p>Balance later {formatMoney(balanceDue, currency)}</p>
            )}
            {payingOnline && balanceDue <= 0 && (
              <p>Nothing left to pay after checkout</p>
            )}
            {!payingOnline && (
              <p>No online payment required</p>
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

      <label
        id="terms-label-container"
        data-booking-field="terms"
        className="flex items-start gap-3 rounded-xl border px-3.5 py-3 text-sm transition-all duration-300"
      >
        <input
          type="checkbox"
          className="mt-0.5 size-4 shrink-0 rounded border-input accent-brand-accent"
          checked={termsAccepted}
          onChange={(e) => setTermsAccepted(e.target.checked)}
        />
        <span className="min-w-0">
          I agree to the{" "}
          <a
            href="/cancellation-policy"
            target="_blank"
            rel="noreferrer"
            className="font-medium text-brand underline underline-offset-2"
          >
            booking terms and cancellation policy
          </a>
          . Cancelling forfeits the deposit paid — it is not refunded. The
          remaining balance is never charged.
        </span>
      </label>

      {showMethodChooser && selectedMethod ? (
        <PaymentMethodChooser
          methods={availableMethods}
          value={selectedMethod}
          onChange={setCheckoutMethod}
          disabled={paypalPending || cashPending || switchingIntent}
        />
      ) : null}

      <div
        key={selectedMethod ?? "none"}
        className="animate-in fade-in-50 slide-in-from-bottom-1 duration-200"
      >
        {selectedMethod === "card" && showStripe && intent && publishableKey ? (
          <div
            className={cn(
              "flex min-w-0 flex-col gap-3 rounded-2xl border border-border/80 bg-brand-surface p-1",
              !termsAccepted && "opacity-70",
            )}
          >
            {!showMethodChooser ? (
              <div className="flex items-center gap-2 px-3 pt-3">
                <CreditCardIcon className="size-4 text-brand-accent" />
                <p className="text-sm font-bold text-brand">Pay by card</p>
              </div>
            ) : null}
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
                customerName={store.customer.name}
                customerEmail={store.customer.email}
                customerPhone={store.customer.phone}
              />
            </Elements>
          </div>
        ) : null}

        {selectedMethod === "paypal" && showPaypal ? (
          <div className="flex flex-col gap-3 rounded-2xl border border-border/80 bg-brand-surface p-4">
            {!showMethodChooser ? (
              <div className="flex items-center gap-2">
                <PaypalMark className="size-4 text-[#003087]" />
                <p className="text-sm font-bold text-brand">Pay with PayPal</p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                You&apos;ll be redirected to PayPal to approve{" "}
                <span className="font-semibold text-brand">
                  {formatMoney(chargeNow, currency)}
                </span>
                , then return here automatically.
              </p>
            )}
            <Button
              type="button"
              size="lg"
              className="h-12 w-full rounded-xl bg-[#003087] text-base font-extrabold text-white hover:bg-[#002b73] active:scale-[0.99]"
              disabled={!termsAccepted || paypalPending || switchingIntent}
              onClick={() => void payWithPaypal()}
            >
              {paypalPending ? (
                <>
                  <Loader2Icon className="animate-spin" data-icon="inline-start" />
                  Redirecting to PayPal…
                </>
              ) : (
                <>
                  <PaypalMark className="size-4" />
                  Continue with PayPal · {formatMoney(chargeNow, currency)}
                </>
              )}
            </Button>
            {paypalError && (
              <p className="text-sm text-destructive">{paypalError}</p>
            )}
            {!showMethodChooser && (
              <p className="text-xs text-muted-foreground">
                You&apos;ll return here after approving the payment on PayPal.
              </p>
            )}
          </div>
        ) : null}

        {selectedMethod === "cash" && showCash ? (
          <div className="flex flex-col gap-3 rounded-2xl border border-border/80 bg-brand-surface p-4">
            <div className="rounded-xl bg-brand-page px-3.5 py-3">
              <p className="text-sm font-bold text-brand">
                Pay {formatMoney(tripTotal, currency)} to your driver
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Your trip is reserved now. No card charge today — settle the
                full amount in cash at pickup
                {referenceCode ? ` (ref ${referenceCode})` : ""}.
              </p>
            </div>
            <Button
              type="button"
              size="lg"
              className="h-12 w-full rounded-xl bg-brand-accent text-base font-extrabold text-white hover:bg-brand-accent-hover active:scale-[0.99]"
              disabled={!termsAccepted || cashPending}
              onClick={() => void confirmCashOnArrival()}
            >
              {cashPending ? (
                <>
                  <Loader2Icon className="animate-spin" data-icon="inline-start" />
                  Confirming…
                </>
              ) : (
                <>
                  <BanknoteIcon className="size-4" />
                  Confirm cash booking
                </>
              )}
            </Button>
            {cashError && (
              <p className="text-sm text-destructive">{cashError}</p>
            )}
          </div>
        ) : null}
      </div>
    </div>
  )
}
