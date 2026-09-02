"use client"

import * as React from "react"
import dynamic from "next/dynamic"
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
  CalendarIcon,
  CarIcon,
  PlaneIcon,
  UsersIcon,
  UserIcon,
  BabyIcon,
  ArrowLeftRightIcon,
  type LucideIcon,
} from "lucide-react"
import useSWR from "swr"
import { toast } from "sonner"

import { apiPost, fetcher } from "@/lib/api"
import { navigateToBookingConfirmation } from "@/lib/navigate-to-confirmation"
import { normalizePaymentOption } from "@/lib/payment-options"
import { clearPokOrderId, rememberPokOrderId } from "@/lib/pok-order-storage"
import type { PaymentOption } from "@/lib/types"
import { createPublicBookingOnce } from "@/lib/public-booking-create"
import {
  isPickupTooSoon,
  pickupLeadTimeMessage,
} from "@/lib/pickup-lead-time"
import { formatDateTime, formatMoney } from "@/lib/format"
import { localePath } from "@/lib/i18n/locales"
import { useLocale, useT } from "@/lib/i18n/use-locale"
import { bypassBookingLeaveGuard } from "@/hooks/use-booking-leave-guard"
import { useBookingFieldFocusListener } from "@/hooks/use-booking-field-focus"
import { focusBookingTerms } from "@/lib/booking-field-focus"
import { useBookingStore } from "@/lib/store/booking-store"
import { getVehicleCatalog, round2, DEFAULT_VEHICLE_CAPACITIES } from "@/lib/vehicles"
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
  pokEnabled?: boolean
  cashOnArrivalEnabled?: boolean
  depositPaymentEnabled?: boolean
  fullPaymentEnabled?: boolean
  vehicleCapacities?: import("@/lib/vehicles").VehicleCapacityConfig
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

type PokOrderResponse = {
  orderId: string
  environment: "staging" | "production"
  paymentOption: PaymentOption
  chargeAmount: number
  currency: string
  bookingId: string
  referenceCode: string
}

/** POK's card form ships its own CSS and touches `window` — browser only. */
const PokCheckoutForm = dynamic(
  () => import("@/components/booking/pok-checkout-form"),
  {
    ssr: false,
    loading: () => <Skeleton className="h-64 w-full rounded-xl" />,
  },
)

let stripePromise: Promise<Stripe | null> | null = null

function getStripePromise(publishableKey: string) {
  if (!stripePromise) {
    stripePromise = loadStripe(publishableKey)
  }
  return stripePromise
}

function Recap() {
  const tr = useT()
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

  const { data: capacityConfig } = useSWR<{
    vehicleCapacities?: import("@/lib/vehicles").VehicleCapacityConfig
  }>("/api/booking/config", fetcher)

  const vehicle = vehicleType
    ? getVehicleCatalog(
      vehicleType,
      capacityConfig?.vehicleCapacities ?? DEFAULT_VEHICLE_CAPACITIES,
    )
    : null
  const seatParts = [
    infantCarrierCount > 0 ? `Infant carrier ×${infantCarrierCount}` : null,
    childSeatCount > 0 ? `Child seat ×${childSeatCount}` : null,
    boosterCount > 0 ? `Booster ×${boosterCount}` : null,
  ].filter(Boolean)

  const [open, setOpen] = React.useState(false)
  const routePreview =
    pickup.address && dropoff.address
      ? `${pickup.address.split(",")[0]} → ${dropoff.address.split(",")[0]}`
      : tr("book.viewTripDetails")
  const pickupPreview = pickupDateTime ? formatDateTime(pickupDateTime) : null

  const tiles: {
    icon: LucideIcon
    label: string
    value: string
  }[] = [
      {
        icon: CalendarIcon,
        label: isRoundTrip ? tr("book.pickup") : tr("book.pickup"),
        value: pickupDateTime ? formatDateTime(pickupDateTime) : "—",
      },
      ...(isRoundTrip
        ? [
          {
            icon: CalendarIcon,
            label: tr("book.return"),
            value: returnDateTime ? formatDateTime(returnDateTime) : "—",
          },
        ]
        : []),
      {
        icon: ArrowLeftRightIcon,
        label: "Direction",
        value:
          direction === "airport_to_dest"
            ? "Airport → Destination"
            : "Destination → Airport",
      },
      {
        icon: CarIcon,
        label: "Vehicle",
        value: `${vehicle?.label ?? vehicleType}${meetAndGreet ? " · Meet & greet" : ""}`,
      },
      {
        icon: UsersIcon,
        label: tr("book.party"),
        value:
          passengerCount === 1
            ? tr("book.passengersSummary", {
                count: passengerCount,
                luggage: luggageCount,
              })
            : tr("book.passengersSummaryPlural", {
                count: passengerCount,
                luggage: luggageCount,
              }),
      },
      ...(flightNumber
        ? [{ icon: PlaneIcon, label: "Flight", value: flightNumber }]
        : []),
      ...(seatParts.length > 0
        ? [{ icon: BabyIcon, label: "Child seats", value: seatParts.join(" · ") }]
        : []),
      {
        icon: UserIcon,
        label: "Contact",
        value: `${customer.name} · ${customer.email}`,
      },
    ]

  return (
    <div className="overflow-hidden rounded-xl border">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-start justify-between gap-3 px-4 py-4 text-left touch-manipulation"
      >
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-extrabold tracking-[0.14em] text-brand-accent uppercase">
            {tr("book.tripRecap")}
          </p>
          <p className="mt-1.5 truncate text-sm font-extrabold text-brand">
            {routePreview}
          </p>
          {pickupPreview ? (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {pickupPreview}
            </p>
          ) : null}
        </div>
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-brand-page text-muted-foreground">
          <ChevronDownIcon
            className={cn(
              "size-4 transition-transform duration-200",
              open && "rotate-180",
            )}
            aria-hidden
          />
        </span>
      </button>

      <div
        className={cn(
          "border-t border-border/70",
          open ? "block" : "hidden",
        )}
      >
        <div className="bg-brand-page/70 px-4 py-4">
          <div className="flex gap-3">
            <div className="flex w-3 shrink-0 flex-col items-center pt-1.5">
              <span className="size-2.5 rounded-full bg-brand-accent shadow-[0_0_0_3px_color-mix(in_srgb,var(--brand-accent)_22%,transparent)]" />
              <span className="my-1 w-px flex-1 bg-border" />
              <span className="size-2.5 rounded-full border-2 border-brand-accent bg-brand-surface" />
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-3.5">
              <div className="min-w-0">
                <p className="text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
                  {tr("book.pickup")}
                </p>
                <p className="mt-0.5 text-sm font-semibold leading-snug text-brand">
                  {pickup.address || "—"}
                </p>
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
                  {tr("book.dropoff")}
                </p>
                <p className="mt-0.5 text-sm font-semibold leading-snug text-brand">
                  {dropoff.address || "—"}
                </p>
              </div>
            </div>
          </div>
        </div>

        <dl className="grid gap-px border-t border-border/70 bg-border/50 sm:grid-cols-2">
          {tiles.map((tile) => (
            <RecapTile
              key={`${tile.label}-${tile.value}`}
              icon={tile.icon}
              label={tile.label}
              value={tile.value}
            />
          ))}
        </dl>
      </div>
    </div>
  )
}

function RecapTile({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon
  label: string
  value: string
}) {
  return (
    <div className="flex items-start gap-3 bg-brand-surface px-4 py-3.5">
      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-page text-brand-accent">
        <Icon className="size-3.5" aria-hidden />
      </span>
      <div className="min-w-0">
        <dt className="text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
          {label}
        </dt>
        <dd className="mt-0.5 break-words text-sm font-semibold leading-snug text-brand">
          {value}
        </dd>
      </div>
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

type CheckoutMethod = "card" | "paypal" | "pok" | "cash"

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
  const tr = useT()
  return (
    <fieldset className="flex flex-col gap-3" disabled={disabled}>
      <legend className="mb-1 text-sm font-bold text-brand">
        {tr("book.choosePaymentMethod")}
      </legend>
      <div
        className="grid gap-2.5"
        role="radiogroup"
        aria-label={tr("book.paymentMethod")}
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
  clientSecret,
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
  clientSecret: string
  termsAccepted: boolean
  customerName: string
  customerEmail: string
  customerPhone: string
}) {
  const tr = useT()
  const locale = useLocale()
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
      setError(tr("book.agreeTermsRequired"))
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
          return_url: `${window.location.origin}${localePath(`/book/confirmation/${referenceCode}`, locale)}`,
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
          paymentIntentClientSecret: clientSecret,
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
                <span>{tr("book.loadingSecure")}</span>
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
              aria-label={tr("book.acceptTermsForCard")}
              onClick={() => {
                setError(tr("book.agreeTermsRequired"))
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
            {tr("book.processingPayment")}
          </>
        ) : (
          <>
            <LockIcon className="size-4" />
            {paymentOption === "full" ? (
              tr("book.payAmount", {
                amount: formatMoney(depositAmount, currency),
              })
            ) : (
              tr("book.payDepositAmount", {
                amount: formatMoney(depositAmount, currency),
              })
            )}
          </>
        )}
      </Button>
      <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
        <ShieldCheckIcon className="size-4 text-brand-accent" />
        <span>{tr("book.pciSecure")}</span>
      </div>
    </form>
  )
}

export function PaymentStep() {
  const router = useRouter()
  const tr = useT()
  const locale = useLocale()
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
  const [pokOrder, setPokOrder] = React.useState<PokOrderResponse | null>(null)
  const [pokLoading, setPokLoading] = React.useState(false)
  const [pokConfirming, setPokConfirming] = React.useState(false)
  const [pokError, setPokError] = React.useState<string | null>(null)
  const pokRequestRef = React.useRef<string | null>(null)
  const [termsInvalid, setTermsInvalid] = React.useState(false)

  useBookingFieldFocusListener("terms")

  React.useEffect(() => {
    if (termsAccepted) {
      setTermsInvalid(false)
      setCashError((prev) =>
        prev?.includes("booking terms") ? null : prev,
      )
    }
  }, [termsAccepted])

  const depositPercentage = settings?.depositPercentage ?? 30
  const stripeEnabled = settings?.stripeEnabled ?? true
  const paypalEnabled = settings?.paypalEnabled ?? true
  const pokEnabled = settings?.pokEnabled ?? false
  const cashOnArrivalEnabled = settings?.cashOnArrivalEnabled ?? false
  const depositPaymentEnabled = settings?.depositPaymentEnabled ?? true
  const fullPaymentEnabled = settings?.fullPaymentEnabled ?? true

  const publishableKey =
    intent?.publishableKey || process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  const showStripe = stripeEnabled && Boolean(intent && publishableKey)
  const showPaypal = paypalEnabled
  const showPok = pokEnabled
  const showCash = cashOnArrivalEnabled

  const availableMethods = React.useMemo(() => {
    const methods: CheckoutMethodOption[] = []
    if (showStripe) {
      methods.push({
        id: "card",
        label: tr("book.methodCard"),
        description: tr("book.methodCardDesc"),
        icon: CreditCardIcon,
        badge: tr("book.recommended"),
      })
    }
    if (showPaypal) {
      methods.push({
        id: "paypal",
        label: tr("book.methodPaypal"),
        description: tr("book.methodPaypalDesc"),
        icon: CreditCardIcon,
      })
    }
    if (showPok) {
      methods.push({
        id: "pok",
        label: tr("book.methodPok"),
        description: tr("book.methodPokDesc"),
        icon: CreditCardIcon,
      })
    }
    if (showCash) {
      methods.push({
        id: "cash",
        label: tr("book.methodCash"),
        description: tr("book.methodCashDesc"),
        icon: BanknoteIcon,
      })
    }
    return methods
  }, [showStripe, showPaypal, showPok, showCash, tr])

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

  React.useEffect(() => {
    patch({ checkoutMethod: selectedMethod })
  }, [selectedMethod, patch])

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
              bookedForOther: store.bookedForOther,
              passengerName: store.bookedForOther
                ? store.passengerName.trim() || null
                : null,
              passengerEmail:
                store.bookedForOther && !store.passengerNoEmail
                  ? store.passengerEmail.trim() || null
                  : null,
              passengerPhone: store.bookedForOther
                ? store.passengerPhone.trim() || null
                : null,
              passengerNoEmail: store.bookedForOther
                ? store.passengerNoEmail
                : false,
              bookerRelation: store.bookedForOther
                ? store.bookerRelation
                : null,
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
      toast.error(tr("book.agreeTermsRequired"))
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

  // POK orders carry the amount, so create one when the customer picks POK and
  // replace it whenever they switch between deposit and full payment.
  React.useEffect(() => {
    const bookingId = store.createdBookingId
    if (selectedMethod !== "pok" || !bookingId) return
    // Keyed on what we asked for, not on what POK returned — the server may
    // normalize the option, and comparing against that would loop forever.
    const requestKey = `${bookingId}:${paymentOption}`
    if (pokRequestRef.current === requestKey) return
    pokRequestRef.current = requestKey

    let cancelled = false
    setPokLoading(true)
    setPokError(null)
    void (async () => {
      try {
        const order = await apiPost<PokOrderResponse>(
          "/api/payments/pok/create-order",
          { bookingId, paymentOption },
        )
        if (cancelled) return
        setPokOrder(order)
        rememberPokOrderId(order.orderId)
      } catch (err) {
        if (cancelled) return
        const error = err as Error & { code?: string }
        setPokOrder(null)
        // Allow a retry when the customer re-selects POK or switches amount.
        pokRequestRef.current = null
        if (error.code === "POK_UNAVAILABLE" || error.code === "METHOD_DISABLED") {
          setPokError("POK is not available right now.")
        } else if (error.code === "SESSION_EXPIRED") {
          setPokError("This payment session has expired. Please start again.")
        } else {
          setPokError(error.message || "Could not start POK checkout.")
        }
      } finally {
        if (!cancelled) setPokLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [selectedMethod, paymentOption, store.createdBookingId])

  async function confirmPokPayment() {
    if (!pokOrder) return
    setPokConfirming(true)
    setPokError(null)
    try {
      const res = await apiPost<{ referenceCode: string }>(
        "/api/payments/pok/confirm",
        { orderId: pokOrder.orderId },
      )
      clearPokOrderId()
      navigateToBookingConfirmation(res.referenceCode)
    } catch (err) {
      setPokConfirming(false)
      setPokError(
        (err as Error).message ||
          "We could not confirm your POK payment. Contact support before paying again.",
      )
    }
  }

  async function confirmCashOnArrival() {
    if (!store.createdBookingId) return
    if (!termsAccepted) {
      const message = tr("book.agreeTermsRequired")
      setCashError(message)
      setTermsInvalid(true)
      toast.error(message)
      focusBookingTerms(message)
      return
    }
    setCashPending(true)
    setCashError(null)
    setTermsInvalid(false)
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
      } else if (error.code === "SUPERSEDED") {
        setCashError(
          "This checkout was replaced by a newer booking. Continue with your latest booking.",
        )
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
          {tr("book.preparingCheckout")}
        </div>
      </div>
    )
  }

  if (bootError || !store.createdBookingId) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
        <p className="font-medium text-destructive">{tr("book.paymentUnavailable")}</p>
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

  if (stripeEnabled && !intent && !showPaypal && !showPok && !showCash) {
    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
        Card payments could not be initialized. Check Stripe configuration or
        enable another payment method in admin settings.
      </div>
    )
  }

  if (!showStripe && !showPaypal && !showPok && !showCash) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
        <p className="font-medium text-destructive">{tr("book.noMethods")}</p>
        <p className="mt-1 text-muted-foreground">
          {tr("book.contactSupport")}
        </p>
      </div>
    )
  }

  const currency = intent?.currency ?? store.createdCurrency ?? "EUR"
  const depositValue = store.createdDepositAmount ?? 0
  const tripTotal = store.quotedPrice ?? depositValue
  const payingOnline =
    selectedMethod === "card" ||
    selectedMethod === "paypal" ||
    selectedMethod === "pok"
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
                  ? tr("book.fullAmountDueNow")
                  : tr("book.depositDueNow")
                : tr("book.amountDueOnArrival")}
            </p>
            <p className="text-2xl font-semibold tabular-nums">
              {formatMoney(payingOnline ? chargeNow : tripTotal, currency)}
            </p>
          </div>
          <div className="text-xs text-muted-foreground sm:text-right">
            <p>
              {tr("book.tripTotal", {
                amount: formatMoney(tripTotal, currency),
              })}
            </p>
            {payingOnline && balanceDue > 0 && (
              <p>
                {tr("book.balanceLater", {
                  amount: formatMoney(balanceDue, currency),
                })}
              </p>
            )}
            {payingOnline && balanceDue <= 0 && (
              <p>{tr("book.nothingLeftAfterCheckout")}</p>
            )}
            {!payingOnline && <p>{tr("book.noOnlinePayment")}</p>}
          </div>
        </div>

        {showPaymentOptionSelector && (
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <PaymentOptionCard
              active={paymentOption === "deposit"}
              disabled={switchingIntent || paypalPending}
              title={tr("book.payDepositNow")}
              amount={formatMoney(depositValue, currency)}
              hint={tr("book.payBalanceLaterHint", {
                amount: formatMoney(
                  Math.max(0, round2(tripTotal - depositValue)),
                  currency,
                ),
              })}
              onSelect={() => setPaymentOption("deposit")}
            />
            <PaymentOptionCard
              active={paymentOption === "full"}
              disabled={switchingIntent || paypalPending}
              title={tr("book.payFullAmount")}
              amount={formatMoney(tripTotal, currency)}
              hint={tr("book.nothingAtPickup")}
              onSelect={() => setPaymentOption("full")}
            />
          </div>
        )}
        {switchingIntent && (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2Icon className="size-3 animate-spin" />
            {tr("book.updatingAmount")}
          </p>
        )}
      </div>

      <label
        id="terms-label-container"
        data-booking-field="terms"
        className={cn(
          "flex items-start gap-3 rounded-xl border border-border px-3.5 py-3 text-sm transition-all duration-300",
          termsInvalid &&
          "border-destructive bg-destructive/5 ring-2 ring-destructive/40",
        )}
      >
        <input
          type="checkbox"
          className="mt-0.5 size-4 shrink-0 rounded border-input accent-brand-accent"
          checked={termsAccepted}
          aria-invalid={termsInvalid || undefined}
          onChange={(e) => setTermsAccepted(e.target.checked)}
        />
        <span className="min-w-0">
          {tr("book.agreeTermsPrefix")}{" "}
          <a
            href={localePath("/cancellation-policy", locale)}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-brand underline underline-offset-2"
          >
            {tr("book.agreeTermsLink")}
          </a>
          {selectedMethod === "cash" ? "." : tr("book.agreeTermsDeposit")}
        </span>
      </label>
      {termsInvalid && !termsAccepted ? (
        <p className="-mt-2 text-xs text-destructive" role="alert">
          {tr("book.agreeTermsRequired")}
        </p>
      ) : null}

      {showMethodChooser && selectedMethod ? (
        <PaymentMethodChooser
          methods={availableMethods}
          value={selectedMethod}
          onChange={setCheckoutMethod}
          disabled={
            paypalPending || cashPending || pokConfirming || switchingIntent
          }
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
                <p className="text-sm font-bold text-brand">{tr("book.payByCard")}</p>
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
                clientSecret={intent.clientSecret}
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
                <p className="text-sm font-bold text-brand">{tr("book.payWithPaypal")}</p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {tr("book.redirectPaypal", {
                  amount: formatMoney(chargeNow, currency),
                })}
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
                  {tr("book.redirectingPaypal")}
                </>
              ) : (
                <>
                  <PaypalMark className="size-4" />
                  {tr("book.continuePaypal", {
                    amount: formatMoney(chargeNow, currency),
                  })}
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

        {selectedMethod === "pok" && showPok ? (
          <div
            className={cn(
              "flex min-w-0 flex-col gap-3 rounded-2xl border border-border/80 bg-brand-surface p-4",
              !termsAccepted && "opacity-70",
            )}
          >
            <div className="flex items-center gap-2">
              <CreditCardIcon className="size-4 text-brand-accent" />
              <p className="text-sm font-bold text-brand">{tr("book.payWithPok")}</p>
            </div>

            {!termsAccepted ? (
              <p className="text-sm text-muted-foreground">
                {tr("book.acceptTermsForCard")}
              </p>
            ) : pokLoading || switchingIntent ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2Icon className="size-4 animate-spin" />
                {tr("book.pokPreparing")}
              </div>
            ) : pokConfirming ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2Icon className="size-4 animate-spin" />
                {tr("book.pokConfirming")}
              </div>
            ) : pokOrder ? (
              <PokCheckoutForm
                key={pokOrder.orderId}
                orderId={pokOrder.orderId}
                environment={pokOrder.environment}
                initialState={{
                  email: store.customer.email,
                  holdersName: store.customer.name,
                }}
                onPaid={() => void confirmPokPayment()}
                onFailed={() =>
                  setPokError(
                    "The payment could not be completed. Check your card details and try again.",
                  )
                }
              />
            ) : null}

            {pokError && <p className="text-sm text-destructive">{pokError}</p>}

            <p className="text-xs text-muted-foreground">
              {tr("book.pokChargedHint", {
                amount: formatMoney(chargeNow, currency),
              })}
            </p>
          </div>
        ) : null}

        {selectedMethod === "cash" && showCash ? (
          <div className="flex flex-col gap-3 rounded-2xl border border-border/80 bg-brand-surface p-4">
            <div className="rounded-xl bg-brand-page px-3.5 py-3">
              <p className="text-sm font-bold text-brand">
                {tr("book.payDriverCash", {
                  amount: formatMoney(tripTotal, currency),
                })}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {tr("book.cashReserveHint", {
                  ref: referenceCode ? ` (ref ${referenceCode})` : "",
                })}
              </p>
            </div>
            <Button
              type="button"
              size="lg"
              className="h-12 w-full rounded-xl bg-brand-accent text-base font-extrabold text-white hover:bg-brand-accent-hover active:scale-[0.99]"
              disabled={cashPending}
              onClick={() => void confirmCashOnArrival()}
            >
              {cashPending ? (
                <>
                  <Loader2Icon className="animate-spin" data-icon="inline-start" />
                  {tr("book.confirming")}
                </>
              ) : (
                <>
                  <BanknoteIcon className="size-4" />
                  {tr("book.confirmCash")}
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
