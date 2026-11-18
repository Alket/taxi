"use client"

import * as React from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import useSWR from "swr"
import { toast } from "sonner"
import {
  AlertCircleIcon,
  ArrowLeft,
  CalendarIcon,
  CarIcon,
  CheckIcon,
  ClockIcon,
  CopyIcon,
  CreditCardIcon,
  InfoIcon,
  Loader2Icon,
  MailIcon,
  MapPinIcon,
  MessageCircleIcon,
  PhoneIcon,
  PlaneIcon,
  SearchIcon,
  ShieldCheckIcon,
  UsersIcon,
  XIcon,
} from "lucide-react"

import { apiPatch, fetcher } from "@/lib/api"
import {
  BOOKING_STATUS_LABELS,
  formatDateTime,
  formatMoney,
} from "@/lib/format"
import { localePath } from "@/lib/i18n/locales"
import { useLocale, useT } from "@/lib/i18n/use-locale"
import type { ManagedBooking } from "@/lib/managed-booking"
import { cn } from "@/lib/utils"
import {
  formatHeroDateLabel,
  HeroDateTimePicker,
} from "@/components/marketing/hero-datetime-picker"
import { MarketingContainer } from "@/components/marketing/marketing-container"
import { ManagedStatusTimeline } from "@/components/booking/managed-status-timeline"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

const HERO_IMAGE =
  "/uploads/pages/book-your-tirana-airport-transfer-08b1cc.webp"

type SupportSettings = {
  supportEmail?: string
  supportPhone?: string
}

function whatsappUrlFromPhone(phone: string) {
  const digits = phone.replace(/\D/g, "")
  return digits ? `https://wa.me/${digits}` : null
}

function NeedHelpCard({
  supportEmail,
  supportPhone,
}: {
  supportEmail: string
  supportPhone: string
}) {
  const tr = useT()
  const locale = useLocale()
  const whatsappUrl = whatsappUrlFromPhone(supportPhone)
  const telHref = supportPhone.replace(/[^\d+]/g, "")

  return (
    <div className="rounded-3xl border border-border/80 bg-brand-surface p-6 shadow-xs sm:p-8">
      <div className="flex items-center gap-2">
        <span className="flex size-7 items-center justify-center rounded-full bg-brand-accent/10 text-brand-accent">
          <InfoIcon className="size-4" />
        </span>
        <h3 className="text-base font-extrabold text-brand sm:text-lg">
          {tr("myBooking.needHelp")}
        </h3>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-brand/75 sm:text-base">
        {tr("myBooking.needHelpBodyBefore")}{" "}
        <Link
          href={localePath("/cancellation-policy", locale)}
          className="font-bold text-brand underline decoration-brand-accent/60 underline-offset-4 transition-colors hover:text-brand-accent"
        >
          {tr("myBooking.cancellationPolicy")}
        </Link>
        {tr("myBooking.needHelpBodyAfter")}
      </p>

      <ul className="mt-6 grid gap-3 sm:grid-cols-3">
        {whatsappUrl ? (
          <li>
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noreferrer"
              className="group flex items-center gap-3.5 rounded-2xl border border-border/80 bg-brand-page/60 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-accent/40 hover:bg-brand-accent/[0.06] hover:shadow-xs active:scale-[0.98]"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#25D366]/15 text-[#128C7E] shadow-2xs transition-transform group-hover:scale-105">
                <MessageCircleIcon className="size-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground">
                  {tr("myBooking.whatsapp")}
                </span>
                <span className="block truncate text-sm font-bold text-brand">
                  {supportPhone}
                </span>
              </span>
            </a>
          </li>
        ) : null}

        {supportPhone ? (
          <li>
            <a
              href={`tel:${telHref}`}
              className="group flex items-center gap-3.5 rounded-2xl border border-border/80 bg-brand-page/60 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-accent/40 hover:bg-brand-accent/[0.06] hover:shadow-xs active:scale-[0.98]"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-accent/15 text-brand-accent shadow-2xs transition-transform group-hover:scale-105">
                <PhoneIcon className="size-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground">
                  {tr("myBooking.phone")}
                </span>
                <span className="block truncate text-sm font-bold text-brand">
                  {supportPhone}
                </span>
              </span>
            </a>
          </li>
        ) : null}

        {supportEmail ? (
          <li>
            <a
              href={`mailto:${supportEmail}`}
              className="group flex items-center gap-3.5 rounded-2xl border border-border/80 bg-brand-page/60 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-accent/40 hover:bg-brand-accent/[0.06] hover:shadow-xs active:scale-[0.98]"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-accent/15 text-brand-accent shadow-2xs transition-transform group-hover:scale-105">
                <MailIcon className="size-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground">
                  {tr("myBooking.email")}
                </span>
                <span className="block truncate text-sm font-bold text-brand">
                  {supportEmail}
                </span>
              </span>
            </a>
          </li>
        ) : null}
      </ul>
    </div>
  )
}

export function MyBookingView() {
  const tr = useT()
  const locale = useLocale()
  const searchParams = useSearchParams()
  const { data: settings } = useSWR<SupportSettings>(
    "/api/settings/public",
    fetcher,
  )
  const supportEmail = settings?.supportEmail?.trim() || "ops@transfers.co"
  const supportPhone = settings?.supportPhone?.trim() || "+355 4 225 1234"

  const [reference, setReference] = React.useState(
    searchParams.get("reference")?.toUpperCase() ?? "",
  )
  const [email, setEmail] = React.useState(searchParams.get("email") ?? "")
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [booking, setBooking] = React.useState<ManagedBooking | null>(null)

  React.useEffect(() => {
    const ref = searchParams.get("reference")
    const mail = searchParams.get("email")
    if (ref && mail) {
      void lookup(ref, mail)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function lookup(ref = reference, mail = email) {
    const cleanedRef = ref.trim()
    const cleanedEmail = mail.trim()
    if (!cleanedRef || !cleanedEmail) {
      setError(tr("myBooking.enterDetails"))
      return
    }

    setPending(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        reference: cleanedRef,
        email: cleanedEmail,
      })
      const res = await fetch(`/api/bookings/lookup?${params.toString()}`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setBooking(null)
        setError(data.error || tr("myBooking.lookupError"))
        return
      }
      setBooking(data.booking)
      setReference(data.booking.referenceCode)
      setEmail(cleanedEmail)
    } catch {
      setBooking(null)
      setError(tr("myBooking.lookupError"))
    } finally {
      setPending(false)
    }
  }

  return (
    <div>
      <section className="relative isolate -mt-24 h-[min(48svh,26rem)] min-h-[19rem] overflow-hidden md:h-[min(44svh,30rem)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={HERO_IMAGE}
          alt=""
          className="absolute inset-0 size-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-brand-panel via-brand-panel/70 to-brand-panel/40" />
        <div className="absolute inset-0 bg-gradient-to-r from-brand-panel/60 via-transparent to-transparent" />

        <MarketingContainer className="relative z-10 flex h-full flex-col justify-end pb-10 pt-28 text-white md:pb-12 md:pt-32">
          <Link
            href={localePath("/", locale)}
            className="group mb-5 inline-flex w-fit items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 text-xs font-bold text-white/90 backdrop-blur-sm transition-all hover:bg-white/20 hover:text-white"
          >
            <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" />
            {tr("myBooking.backHome")}
          </Link>
          <h1 className="max-w-3xl font-brand text-3xl font-extrabold tracking-tight text-white sm:text-4xl md:text-5xl">
            {tr("myBooking.title")}
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/85 sm:text-base md:text-lg">
            {tr("myBooking.hero")}
          </p>
        </MarketingContainer>
      </section>

      <section className="bg-brand-page py-10 md:py-14">
        <MarketingContainer className="flex flex-col gap-6">
          <form
            className="rounded-3xl border border-border/80 bg-brand-surface p-6 shadow-xs sm:p-8 md:p-10"
            onSubmit={(e) => {
              e.preventDefault()
              void lookup()
            }}
          >
            <div className="mb-6">
              <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-brand-accent/25 bg-brand-accent/10 px-3 py-1 text-xs font-extrabold uppercase tracking-wider text-brand-accent">
                <SearchIcon className="size-3" aria-hidden />
                <span>{tr("myBooking.title")}</span>
              </div>
              <h2 className="font-brand text-2xl font-black tracking-tight text-brand sm:text-3xl">
                {tr("myBooking.findTitle")}
              </h2>
              <p className="mt-1.5 text-sm text-brand/75 sm:text-base">
                {tr("myBooking.findDesc")}
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label
                  htmlFor="reference"
                  className="text-xs font-extrabold uppercase tracking-wider text-brand/80"
                >
                  {tr("myBooking.reference")}
                </Label>
                <Input
                  id="reference"
                  value={reference}
                  onChange={(e) => setReference(e.target.value.toUpperCase())}
                  placeholder="TRF-8F3K2A"
                  className="h-12 rounded-xl border border-border/80 bg-brand-page/40 px-4 font-mono text-base font-bold tracking-wider uppercase text-brand placeholder:font-sans placeholder:text-sm placeholder:normal-case placeholder:tracking-normal placeholder:text-muted-foreground/60 transition-colors focus-visible:border-brand-accent focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-brand-accent/20"
                  autoComplete="off"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label
                  htmlFor="email"
                  className="text-xs font-extrabold uppercase tracking-wider text-brand/80"
                >
                  {tr("myBooking.email")}
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={tr("myBooking.emailPlaceholder")}
                  className="h-12 rounded-xl border border-border/80 bg-brand-page/40 px-4 text-base font-medium text-brand placeholder:text-sm placeholder:text-muted-foreground/60 transition-colors focus-visible:border-brand-accent focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-brand-accent/20"
                  autoComplete="email"
                />
              </div>
            </div>

            {error && (
              <div className="mt-4 flex items-center gap-2.5 rounded-2xl border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm font-medium text-destructive">
                <AlertCircleIcon className="size-4 shrink-0 text-destructive" />
                <span>{error}</span>
              </div>
            )}

            <Button
              type="submit"
              size="lg"
              className="mt-6 h-12 w-full rounded-full bg-brand-accent px-8 text-base font-extrabold text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:brightness-95 active:scale-[0.98] sm:w-auto sm:min-w-[13rem]"
              disabled={pending}
            >
              {pending ? (
                <>
                  <Loader2Icon className="size-4 animate-spin" data-icon="inline-start" />
                  {tr("myBooking.lookingUp")}
                </>
              ) : (
                <>
                  <SearchIcon className="size-4" data-icon="inline-start" />
                  {tr("myBooking.findBooking")}
                </>
              )}
            </Button>
          </form>

          {booking && (
            <BookingManagePanel
              booking={booking}
              email={email}
              onUpdated={setBooking}
            />
          )}

          <NeedHelpCard
            supportEmail={supportEmail}
            supportPhone={supportPhone}
          />
        </MarketingContainer>
      </section>
    </div>
  )
}

function BookingManagePanel({
  booking,
  email,
  onUpdated,
}: {
  booking: ManagedBooking
  email: string
  onUpdated: (booking: ManagedBooking) => void
}) {
  const tr = useT()
  const [cancelOpen, setCancelOpen] = React.useState(false)
  const [editOpen, setEditOpen] = React.useState(false)
  const [copied, setCopied] = React.useState(false)

  async function copyReference() {
    try {
      await navigator.clipboard.writeText(booking.referenceCode)
      setCopied(true)
      toast.success("Reference code copied.")
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error("Could not copy reference code.")
    }
  }

  const isCancelled = booking.status === "cancelled"
  const isCompleted = booking.status === "completed"

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-hidden rounded-3xl border border-border/80 bg-brand-surface shadow-xs">
        {/* Header Bar */}
        <div className="border-b border-border/70 bg-brand-page/60 px-6 py-6 sm:px-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-accent/30 bg-brand-accent/15 px-3 py-0.5 text-[11px] font-black uppercase tracking-wider text-brand-accent">
                <ShieldCheckIcon className="size-3" />
                {tr("myBooking.found")}
              </span>

              <div className="mt-2.5 flex flex-wrap items-center gap-2.5 sm:gap-3">
                <span className="font-mono text-2xl font-black tracking-tight text-brand sm:text-3xl">
                  {booking.referenceCode}
                </span>
                <button
                  type="button"
                  onClick={() => void copyReference()}
                  className="inline-flex size-8 items-center justify-center rounded-lg border border-border/80 bg-brand-surface text-brand/70 shadow-2xs transition-all hover:border-brand-accent/40 hover:bg-brand-accent/5 hover:text-brand-accent active:scale-95"
                  title="Copy reference code"
                  aria-label="Copy reference code"
                >
                  {copied ? (
                    <CheckIcon className="size-3.5 text-brand-accent" />
                  ) : (
                    <CopyIcon className="size-3.5" />
                  )}
                </button>
                {booking.pickupPin ? (
                  <span className="inline-flex items-center gap-1 rounded-md border border-border/90 bg-brand-surface px-2.5 py-1 font-mono text-xs font-bold tabular-nums text-brand shadow-2xs">
                    {tr("myBooking.pin", { pin: booking.pickupPin })}
                  </span>
                ) : null}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold capitalize",
                    isCancelled
                      ? "border border-destructive/20 bg-destructive/10 text-destructive"
                      : isCompleted
                        ? "border border-brand-accent/30 bg-brand-accent/15 text-brand-accent"
                        : "border border-brand-accent/20 bg-brand-accent/10 text-brand-accent",
                  )}
                >
                  <span
                    className={cn(
                      "size-1.5 rounded-full",
                      isCancelled ? "bg-destructive" : "bg-brand-accent",
                    )}
                  />
                  {BOOKING_STATUS_LABELS[booking.status]}
                </span>
                <span className="inline-flex items-center rounded-full border border-border/80 bg-brand-surface px-3 py-1 text-xs font-bold text-brand/80 shadow-2xs">
                  {booking.paymentStatusLabel}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2.5">
              {booking.editable && (
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 rounded-full border border-border/80 bg-brand-surface px-5 text-xs font-bold text-brand shadow-2xs transition-all hover:-translate-y-0.5 hover:bg-muted active:scale-[0.98]"
                  onClick={() => setEditOpen(true)}
                >
                  <CalendarIcon className="size-3.5" data-icon="inline-start" />
                  {tr("myBooking.changeDate")}
                </Button>
              )}
              {booking.cancellable && (
                <Button
                  type="button"
                  className="h-11 rounded-full border border-destructive/20 bg-destructive/10 px-5 text-xs font-bold text-destructive shadow-none transition-all hover:-translate-y-0.5 hover:bg-destructive hover:text-white active:scale-[0.98]"
                  onClick={() => setCancelOpen(true)}
                >
                  <XIcon className="size-3.5" data-icon="inline-start" />
                  {tr("myBooking.cancelBooking")}
                </Button>
              )}
            </div>
          </div>

          {!isCancelled && !isCompleted ? (
            <div className="mt-5 flex items-start gap-2.5 rounded-2xl border border-border/60 bg-brand-surface/80 p-3.5 text-xs leading-relaxed text-muted-foreground">
              <InfoIcon className="size-4 shrink-0 text-brand/60 mt-0.5" />
              <p>
                {booking.cancellable
                  ? booking.cashOnArrival
                    ? null
                    : tr("myBooking.cancelForfeit")
                  : tr("myBooking.cancelTooLate")}
                {booking.cancellable && !booking.cashOnArrival ? " " : null}
                {booking.editable
                  ? tr("myBooking.editUntilAssigned")
                  : tr("myBooking.editTooLate")}
              </p>
            </div>
          ) : null}
        </div>

        {/* Content Body Grid */}
        <div className="grid gap-8 p-6 sm:p-8 md:grid-cols-2">
          {/* Timeline Column */}
          <div className="rounded-2xl border border-border/70 bg-brand-page/40 p-5 sm:p-6">
            <h3 className="mb-4 flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-brand">
              <ClockIcon className="size-4 text-brand-accent" />
              {tr("myBooking.status")}
            </h3>
            <ManagedStatusTimeline
              status={booking.status}
              timeline={booking.timeline}
              cancelledAt={booking.cancelledAt}
            />
          </div>

          {/* Trip, Payment & Driver Column */}
          <div className="flex flex-col gap-5">
            {/* Trip Details */}
            <div className="rounded-2xl border border-border/70 bg-brand-page/40 p-5 sm:p-6">
              <h3 className="mb-4 flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-brand">
                <MapPinIcon className="size-4 text-brand-accent" />
                {tr("myBooking.trip")}
              </h3>
              <dl className="flex flex-col">
                <InfoRow
                  label={tr("myBooking.direction")}
                  value={booking.directionLabel}
                />
                <InfoRow
                  label={tr("myBooking.route")}
                  value={`${booking.pickupAddress} → ${booking.dropoffAddress}`}
                />
                <InfoRow
                  label={tr("myBooking.pickup")}
                  value={formatDateTime(booking.pickupDateTime)}
                />
                {booking.flightNumber && (
                  <InfoRow
                    icon={PlaneIcon}
                    label={tr("myBooking.flight")}
                    value={booking.flightNumber}
                  />
                )}
                <InfoRow
                  icon={CarIcon}
                  label={tr("myBooking.vehicle")}
                  value={`${booking.vehicleLabel}${
                    booking.meetAndGreet
                      ? ` · ${tr("myBooking.meetAndGreet")}`
                      : ""
                  }`}
                />
                <InfoRow
                  icon={UsersIcon}
                  label={tr("myBooking.party")}
                  value={tr("myBooking.partyValue", {
                    passengers: booking.passengerCount,
                    bags: booking.luggageCount,
                  })}
                />
              </dl>
            </div>

            {/* Payment Details */}
            <div className="rounded-2xl border border-border/70 bg-brand-page/40 p-5 sm:p-6">
              <h3 className="mb-4 flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-brand">
                <CreditCardIcon className="size-4 text-brand-accent" />
                {tr("myBooking.payment")}
              </h3>
              <dl className="flex flex-col gap-2.5 rounded-xl border border-border/80 bg-brand-surface p-4 text-sm shadow-2xs">
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground font-medium">
                    {tr("myBooking.total")}
                  </span>
                  <span className="font-bold tabular-nums text-brand">
                    {formatMoney(booking.totalPrice, booking.currency)}
                  </span>
                </div>
                {booking.paymentStatus === "fully_paid" ||
                booking.paymentStatus === "paid" ? (
                  <div className="flex justify-between gap-3 border-t border-border/50 pt-2">
                    <span className="text-muted-foreground font-medium">
                      {tr("myBooking.paidInFull")}
                    </span>
                    <span className="font-extrabold tabular-nums text-brand-accent">
                      {formatMoney(
                        booking.depositPaid || booking.totalPrice,
                        booking.currency,
                      )}
                    </span>
                  </div>
                ) : (
                  <>
                    {!booking.cashOnArrival ? (
                      <div className="flex justify-between gap-3 border-t border-border/50 pt-2">
                        <span className="text-muted-foreground font-medium">
                          {tr("myBooking.depositPaid")}
                        </span>
                        <span className="font-semibold tabular-nums text-brand">
                          {formatMoney(booking.depositPaid, booking.currency)}
                        </span>
                      </div>
                    ) : null}
                    <div className="flex justify-between gap-3 border-t border-border/50 pt-2">
                      <span className="text-muted-foreground font-medium">
                        {tr("myBooking.balanceDue")}
                      </span>
                      <span className="font-black tabular-nums text-brand-accent">
                        {formatMoney(booking.balanceDue, booking.currency)}
                      </span>
                    </div>
                  </>
                )}
              </dl>
            </div>

            {/* Assigned Driver Card */}
            {booking.driver && (
              <div className="rounded-2xl border border-brand-accent/25 bg-brand-accent/[0.04] p-5 sm:p-6 shadow-2xs">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-brand-accent">
                      <CarIcon className="size-3.5" />
                      {tr("myBooking.yourDriver")}
                    </h3>
                    <p className="mt-1.5 text-base font-extrabold text-brand">
                      {booking.driver.name}
                    </p>
                    <p className="mt-0.5 text-xs font-medium text-muted-foreground">
                      {booking.driver.vehicleMake} {booking.driver.vehicleModel}
                    </p>
                  </div>
                  <span className="inline-block rounded-md border border-border/80 bg-brand-surface px-2.5 py-1 font-mono text-xs font-bold text-brand shadow-2xs">
                    {booking.driver.plateNumber}
                  </span>
                </div>
                {booking.driver.whatsappUrl && (
                  <a
                    href={booking.driver.whatsappUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-full bg-[#25D366] px-4 text-xs font-extrabold text-white shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#20ba59] active:scale-[0.98] sm:w-auto"
                  >
                    <MessageCircleIcon className="size-4" />
                    {tr("myBooking.messageWhatsApp")}
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <CancelBookingDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        booking={booking}
        email={email}
        onCancelled={(next) => {
          onUpdated(next)
          setCancelOpen(false)
        }}
      />

      <EditBookingDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        booking={booking}
        email={email}
        onSaved={(next) => {
          onUpdated(next)
          setEditOpen(false)
        }}
      />
    </div>
  )
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon?: React.ComponentType<{ className?: string }>
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="grid gap-1 border-b border-border/40 py-2.5 sm:grid-cols-[7rem_1fr] sm:gap-3 last:border-none">
      <dt className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
        {Icon ? <Icon className="size-3.5 shrink-0 text-brand/60" /> : null}
        <span>{label}</span>
      </dt>
      <dd className="min-w-0 break-words text-sm font-semibold text-brand">
        {value}
      </dd>
    </div>
  )
}

function CancelBookingDialog({
  open,
  onOpenChange,
  booking,
  email,
  onCancelled,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  booking: ManagedBooking
  email: string
  onCancelled: (booking: ManagedBooking) => void
}) {
  const tr = useT()
  const [pending, setPending] = React.useState(false)

  async function confirmCancel() {
    setPending(true)
    try {
      const res = await apiPatch<{
        booking: ManagedBooking
        depositForfeited: boolean
      }>(`/api/bookings/${booking.id}/cancel`, {
        email,
        reference: booking.referenceCode,
      })
      toast.success(
        booking.cashOnArrival
          ? tr("myBooking.cancelCashSuccess")
          : tr("myBooking.cancelSuccess"),
      )
      onCancelled(res.booking)
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl sm:max-w-md">
        <DialogHeader>
          <div className="mb-2 flex size-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertCircleIcon className="size-5" />
          </div>
          <DialogTitle className="font-brand text-xl font-extrabold text-brand">
            {tr("myBooking.cancelTitle")}
          </DialogTitle>
          <DialogDescription className="mt-1 text-sm leading-relaxed text-muted-foreground">
            {booking.cashOnArrival
              ? tr("myBooking.cancelCashDesc")
              : tr("myBooking.cancelDesc")}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-2">
          <DialogClose
            render={
              <Button
                variant="outline"
                className="h-11 w-full rounded-full border border-border/80 bg-brand-surface px-5 text-sm font-bold text-brand shadow-none hover:bg-muted active:scale-[0.98] sm:w-auto"
              />
            }
          >
            {tr("myBooking.keepBooking")}
          </DialogClose>
          <Button
            disabled={pending}
            className="h-11 w-full rounded-full bg-destructive px-5 text-sm font-extrabold text-white shadow-none transition-all hover:bg-destructive/90 active:scale-[0.98] sm:w-auto"
            onClick={() => void confirmCancel()}
          >
            {pending
              ? tr("myBooking.cancelling")
              : tr("myBooking.confirmCancel")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function EditBookingDialog({
  open,
  onOpenChange,
  booking,
  email,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  booking: ManagedBooking
  email: string
  onSaved: (booking: ManagedBooking) => void
}) {
  const tr = useT()
  const [pending, setPending] = React.useState(false)
  const [calendarOpen, setCalendarOpen] = React.useState(false)
  const [pickupDateTime, setPickupDateTime] = React.useState(
    booking.pickupDateTime,
  )

  React.useEffect(() => {
    if (!open) return
    setPickupDateTime(booking.pickupDateTime)
    setCalendarOpen(false)
  }, [open, booking])

  async function save() {
    if (!pickupDateTime) {
      toast.error(tr("myBooking.selectPickup"))
      return
    }

    setPending(true)
    try {
      const res = await apiPatch<{ booking: ManagedBooking }>(
        `/api/bookings/${booking.id}`,
        {
          email,
          pickupDateTime: new Date(pickupDateTime).toISOString(),
        },
      )
      if (!res.booking) throw new Error(tr("myBooking.updateFailed"))
      toast.success(tr("myBooking.updateSuccess"))
      onSaved(res.booking)
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl sm:max-w-md">
        <DialogHeader>
          <div className="mb-2 flex size-10 items-center justify-center rounded-full bg-brand-accent/10 text-brand-accent">
            <CalendarIcon className="size-5" />
          </div>
          <DialogTitle className="font-brand text-xl font-extrabold text-brand">
            {tr("myBooking.editTitle")}
          </DialogTitle>
          <DialogDescription className="mt-1 text-sm leading-relaxed text-muted-foreground">
            {tr("myBooking.editDesc")}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 flex flex-col gap-2">
          <Label className="text-xs font-extrabold uppercase tracking-wider text-brand/80">
            {tr("myBooking.pickupDateTime")}
          </Label>
          <HeroDateTimePicker
            inDialog
            value={pickupDateTime}
            open={calendarOpen}
            onOpenChange={setCalendarOpen}
            onChange={setPickupDateTime}
            trigger={
              <button
                type="button"
                onClick={() => setCalendarOpen(true)}
                className={cn(
                  "flex h-12 w-full items-center gap-3 rounded-xl border border-border/80 bg-brand-page/40 px-3.5 py-2 text-left text-sm transition-colors hover:bg-white hover:border-brand-accent/50",
                  calendarOpen &&
                    "border-brand-accent bg-white ring-2 ring-brand-accent/20",
                )}
              >
                <CalendarIcon className="size-4 shrink-0 text-brand-accent" />
                <span
                  className={cn(
                    "flex-1 font-semibold",
                    pickupDateTime ? "text-brand" : "text-muted-foreground",
                  )}
                >
                  {formatHeroDateLabel(pickupDateTime)}
                </span>
              </button>
            }
          />
        </div>

        <DialogFooter className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-2">
          <DialogClose
            render={
              <Button
                variant="outline"
                className="h-11 w-full rounded-full border border-border/80 bg-brand-surface px-5 text-sm font-bold text-brand shadow-none hover:bg-muted active:scale-[0.98] sm:w-auto"
              />
            }
          >
            {tr("myBooking.cancel")}
          </DialogClose>
          <Button
            disabled={pending || !pickupDateTime}
            className="h-11 w-full rounded-full bg-brand-accent px-5 text-sm font-extrabold text-white shadow-none transition-all hover:bg-brand-accent-hover hover:brightness-95 active:scale-[0.98] disabled:opacity-50 sm:w-auto"
            onClick={() => void save()}
          >
            {pending ? (
              <>
                <Loader2Icon className="size-4 animate-spin" data-icon="inline-start" />
                {tr("myBooking.saving")}
              </>
            ) : (
              tr("myBooking.saveDate")
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
