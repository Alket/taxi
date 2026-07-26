"use client"

import * as React from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import useSWR from "swr"
import { toast } from "sonner"
import {
  ArrowLeft,
  CalendarIcon,
  CarIcon,
  Loader2Icon,
  MailIcon,
  MessageCircleIcon,
  PhoneIcon,
  SearchIcon,
  XIcon,
} from "lucide-react"

import { apiPatch, fetcher } from "@/lib/api"
import { DESTINATIONS } from "@/lib/destinations"
import {
  BOOKING_STATUS_LABELS,
  formatDateTime,
  formatMoney,
} from "@/lib/format"
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

const LOOKUP_ERROR = "We couldn't find a booking matching those details."

const HERO_IMAGE =
  DESTINATIONS.find((d) => d.id === "vlore")?.image ||
  DESTINATIONS[0]?.image ||
  ""

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
  const whatsappUrl = whatsappUrlFromPhone(supportPhone)
  const telHref = supportPhone.replace(/[^\d+]/g, "")

  return (
    <div className="rounded-3xl border border-border/80 bg-brand-surface px-5 py-5 sm:px-7 sm:py-6">
      <p className="text-sm font-extrabold text-brand">Need help?</p>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
        Check your confirmation email for the reference code, or review our{" "}
        <Link
          href="/cancellation-policy"
          className="font-semibold text-brand underline underline-offset-2"
        >
          cancellation policy
        </Link>
        . Our team is happy to help.
      </p>

      <ul className="mt-4 grid gap-2.5 sm:grid-cols-3">
        {whatsappUrl ? (
          <li>
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-3 rounded-2xl border border-border bg-brand-page px-3.5 py-3 transition-colors hover:border-brand-accent/40 hover:bg-brand-accent/[0.06]"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#25D366]/15 text-[#128C7E]">
                <MessageCircleIcon className="size-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-[11px] font-extrabold tracking-wider text-muted-foreground uppercase">
                  WhatsApp
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
              className="flex items-center gap-3 rounded-2xl border border-border bg-brand-page px-3.5 py-3 transition-colors hover:border-brand-accent/40 hover:bg-brand-accent/[0.06]"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-accent/15 text-brand-accent">
                <PhoneIcon className="size-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-[11px] font-extrabold tracking-wider text-muted-foreground uppercase">
                  Phone
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
              className="flex items-center gap-3 rounded-2xl border border-border bg-brand-page px-3.5 py-3 transition-colors hover:border-brand-accent/40 hover:bg-brand-accent/[0.06]"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-accent/15 text-brand-accent">
                <MailIcon className="size-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-[11px] font-extrabold tracking-wider text-muted-foreground uppercase">
                  Email
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
      setError("Enter your reference code and email.")
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
        setError(data.error || LOOKUP_ERROR)
        return
      }
      setBooking(data.booking)
      setReference(data.booking.referenceCode)
      setEmail(cleanedEmail)
    } catch {
      setBooking(null)
      setError(LOOKUP_ERROR)
    } finally {
      setPending(false)
    }
  }

  return (
    <div>
      <section className="relative isolate -mt-24 h-[min(48svh,26rem)] min-h-[18rem] overflow-hidden md:h-[min(44svh,30rem)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={HERO_IMAGE}
          alt=""
          className="absolute inset-0 size-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-brand-panel via-brand-panel/60 to-brand-panel/30" />
        <div className="absolute inset-0 bg-gradient-to-r from-brand-panel/55 via-transparent to-transparent" />

        <MarketingContainer className="relative z-10 flex h-full flex-col justify-end pb-10 pt-28 text-white md:pb-12 md:pt-32">
          <Link
            href="/"
            className="mb-5 inline-flex w-fit items-center gap-1.5 text-sm font-bold text-white/75 transition-colors hover:text-white"
          >
            <ArrowLeft className="size-4" />
            Back to home
          </Link>
          <h1 className="max-w-3xl font-brand text-4xl font-extrabold tracking-tight sm:text-5xl">
            My booking
          </h1>
          <p className="mt-3 max-w-xl text-base leading-relaxed text-white/85 md:text-lg">
            Look up your transfer with the reference code and email from your
            confirmation. No account needed.
          </p>
        </MarketingContainer>
      </section>

      <section className="bg-brand-page py-10 md:py-14">
        <MarketingContainer>
          <div className="mx-auto flex max-w-3xl flex-col gap-6">
            <form
              className="rounded-3xl border border-border bg-brand-surface p-5 shadow-sm sm:p-7"
              onSubmit={(e) => {
                e.preventDefault()
                void lookup()
              }}
            >
              <div className="mb-5">
                <h2 className="font-brand text-xl font-extrabold tracking-tight text-brand">
                  Find your transfer
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Enter the details from your confirmation email.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="reference" className="text-sm font-bold text-brand">
                    Reference code
                  </Label>
                  <Input
                    id="reference"
                    value={reference}
                    onChange={(e) => setReference(e.target.value.toUpperCase())}
                    placeholder="TRF-8F3K2A"
                    className="h-11 font-mono uppercase"
                    autoComplete="off"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="email" className="text-sm font-bold text-brand">
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="h-11"
                    autoComplete="email"
                  />
                </div>
              </div>

              {error && (
                <p className="mt-4 rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                  {error}
                </p>
              )}

              <Button
                type="submit"
                size="lg"
                className="mt-5 h-12 w-full rounded-xl bg-brand-accent text-base font-extrabold text-white hover:bg-brand-accent-hover sm:w-auto sm:min-w-[12rem]"
                disabled={pending}
              >
                {pending ? (
                  <>
                    <Loader2Icon className="animate-spin" data-icon="inline-start" />
                    Looking up…
                  </>
                ) : (
                  <>
                    <SearchIcon data-icon="inline-start" />
                    Find booking
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
          </div>
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
  const [cancelOpen, setCancelOpen] = React.useState(false)
  const [editOpen, setEditOpen] = React.useState(false)

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-hidden rounded-3xl border border-border bg-brand-surface shadow-sm">
        <div className="border-b border-border/70 bg-brand-page/60 px-5 py-5 sm:px-7 sm:py-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-extrabold tracking-[0.14em] text-brand-accent uppercase">
                Booking found
              </p>
              <p className="mt-1 font-mono text-xl font-extrabold tracking-tight text-brand">
                {booking.referenceCode}
              </p>
              <p className="mt-1 font-mono text-sm font-semibold tabular-nums text-brand">
                PIN {booking.pickupPin}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {BOOKING_STATUS_LABELS[booking.status]} ·{" "}
                {booking.paymentStatusLabel}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {booking.editable && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="rounded-full font-bold"
                  onClick={() => setEditOpen(true)}
                >
                  <CalendarIcon data-icon="inline-start" />
                  Change date
                </Button>
              )}
              {booking.cancellable && (
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  className="rounded-full font-bold"
                  onClick={() => setCancelOpen(true)}
                >
                  <XIcon data-icon="inline-start" />
                  Cancel booking
                </Button>
              )}
            </div>
          </div>

          {booking.status !== "cancelled" && booking.status !== "completed" ? (
            <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
              {booking.cancellable ? (
                <>
                  Cancelling forfeits the deposit paid — it is not refunded. The
                  remaining balance is never charged.
                </>
              ) : (
                <>
                  This booking can no longer be cancelled online after the driver
                  has arrived. Contact support if you need help.
                </>
              )}{" "}
              {booking.editable
                ? "You can change the pickup date until a driver is assigned."
                : "Pickup date can no longer be changed online."}
            </p>
          ) : null}
        </div>

        <div className="grid gap-8 p-5 sm:p-7 md:grid-cols-2">
          <div>
            <h2 className="mb-3 text-sm font-extrabold text-brand">Status</h2>
            <ManagedStatusTimeline
              status={booking.status}
              timeline={booking.timeline}
              cancelledAt={booking.cancelledAt}
            />
          </div>

          <div className="flex flex-col gap-5">
            <div>
              <h2 className="mb-3 text-sm font-extrabold text-brand">Trip</h2>
              <dl className="flex flex-col gap-2.5 text-sm">
                <InfoRow label="Direction" value={booking.directionLabel} />
                <InfoRow
                  label="Route"
                  value={`${booking.pickupAddress} → ${booking.dropoffAddress}`}
                />
                <InfoRow
                  label="Pickup"
                  value={formatDateTime(booking.pickupDateTime)}
                />
                {booking.flightNumber && (
                  <InfoRow label="Flight" value={booking.flightNumber} />
                )}
                <InfoRow
                  label="Vehicle"
                  value={`${booking.vehicleLabel}${booking.meetAndGreet ? " · Meet & greet" : ""}`}
                />
                <InfoRow
                  label="Party"
                  value={`${booking.passengerCount} passengers, ${booking.luggageCount} bags`}
                />
              </dl>
            </div>

            <div>
              <h2 className="mb-3 text-sm font-extrabold text-brand">Payment</h2>
              <dl className="flex flex-col gap-2 rounded-2xl bg-brand-page px-4 py-3.5 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Total</span>
                  <span className="font-semibold tabular-nums text-brand">
                    {formatMoney(booking.totalPrice, booking.currency)}
                  </span>
                </div>
                {booking.paymentStatus === "fully_paid" ||
                booking.paymentStatus === "paid" ? (
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Paid in full</span>
                    <span className="font-semibold tabular-nums text-brand">
                      {formatMoney(
                        booking.depositPaid || booking.totalPrice,
                        booking.currency,
                      )}
                    </span>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between gap-3">
                      <span className="text-muted-foreground">Deposit paid</span>
                      <span className="font-semibold tabular-nums text-brand">
                        {formatMoney(booking.depositPaid, booking.currency)}
                      </span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-muted-foreground">Balance due</span>
                      <span className="font-extrabold tabular-nums text-brand-accent">
                        {formatMoney(booking.balanceDue, booking.currency)}
                      </span>
                    </div>
                  </>
                )}
              </dl>
            </div>

            {booking.driver && (
              <div className="rounded-2xl border border-border bg-brand-page p-4">
                <h2 className="mb-2 flex items-center gap-1.5 text-sm font-extrabold text-brand">
                  <CarIcon className="size-4 text-brand-accent" />
                  Your driver
                </h2>
                <p className="text-sm font-bold text-brand">{booking.driver.name}</p>
                <p className="text-xs text-muted-foreground">
                  {booking.driver.vehicleMake} {booking.driver.vehicleModel} ·{" "}
                  <span className="font-mono">{booking.driver.plateNumber}</span>
                </p>
                {booking.driver.whatsappUrl && (
                  <a
                    href={booking.driver.whatsappUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-flex h-9 items-center justify-center gap-1.5 rounded-full border border-border bg-brand-surface px-3.5 text-xs font-bold text-brand transition-colors hover:bg-muted"
                  >
                    <MessageCircleIcon className="size-3.5" />
                    Message via WhatsApp
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

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-0.5 sm:grid-cols-[6.5rem_1fr] sm:gap-2">
      <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="min-w-0 break-words font-medium text-brand">{value}</dd>
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
        "Booking cancelled. Your deposit has been forfeited and will not be refunded.",
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cancel booking?</DialogTitle>
          <DialogDescription>
            Cancelling forfeits your deposit and cannot be undone. The remaining
            balance will not be charged.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            Keep booking
          </DialogClose>
          <Button
            variant="destructive"
            disabled={pending}
            onClick={() => void confirmCancel()}
          >
            {pending ? "Cancelling…" : "Confirm cancellation"}
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
      toast.error("Select a pickup date and time.")
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
      if (!res.booking) throw new Error("Update failed.")
      toast.success("Pickup date updated.")
      onSaved(res.booking)
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Change pickup date</DialogTitle>
          <DialogDescription>
            Choose a new pickup date and time for your transfer.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-1.5">
          <Label className="text-sm font-bold text-brand">
            Pickup date & time
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
                  "flex h-12 w-full items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-left text-sm transition-colors hover:bg-muted/50",
                  calendarOpen &&
                    "border-brand-accent ring-2 ring-brand-accent ring-offset-2",
                )}
              >
                <CalendarIcon className="size-4 shrink-0 text-muted-foreground" />
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

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            Cancel
          </DialogClose>
          <Button disabled={pending || !pickupDateTime} onClick={() => void save()}>
            {pending ? "Saving…" : "Save date"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
