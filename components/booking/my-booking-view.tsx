"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import { toast } from "sonner"
import {
  CalendarIcon,
  CarIcon,
  Loader2Icon,
  MessageCircleIcon,
  SearchIcon,
  XIcon,
} from "lucide-react"

import { apiPatch } from "@/lib/api"
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
import { Separator } from "@/components/ui/separator"

const LOOKUP_ERROR = "We couldn't find a booking matching those details."

export function MyBookingView() {
  const searchParams = useSearchParams()
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
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8 md:px-6 md:py-10">
      <div>
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Self-service
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">My booking</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Look up your transfer with the reference code and email from your
          confirmation. No account needed.
        </p>
      </div>

      <form
        className="rounded-xl border bg-card p-4 sm:p-5"
        onSubmit={(e) => {
          e.preventDefault()
          void lookup()
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reference">Reference code</Label>
            <Input
              id="reference"
              value={reference}
              onChange={(e) => setReference(e.target.value.toUpperCase())}
              placeholder="TRF-8F3K2A"
              className="font-mono uppercase"
              autoComplete="off"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
            />
          </div>
        </div>
        {error && (
          <p className="mt-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" className="mt-4" disabled={pending}>
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
      <div className="rounded-xl border bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-mono text-lg font-semibold tracking-tight">
              {booking.referenceCode}
            </p>
            <p className="mt-1 font-mono text-sm font-medium tabular-nums">
              PIN {booking.pickupPin}
            </p>
            <p className="text-sm text-muted-foreground">
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
                onClick={() => setCancelOpen(true)}
              >
                <XIcon data-icon="inline-start" />
                Cancel booking
              </Button>
            )}
          </div>
        </div>

        {booking.status !== "cancelled" && booking.status !== "completed" ? (
          <p className="mt-3 text-xs text-muted-foreground">
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

        <Separator className="my-4" />

        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <h2 className="mb-3 text-sm font-semibold">Status</h2>
            <ManagedStatusTimeline
              status={booking.status}
              timeline={booking.timeline}
              cancelledAt={booking.cancelledAt}
            />
          </div>

          <div className="flex flex-col gap-4">
            <div>
              <h2 className="mb-3 text-sm font-semibold">Trip</h2>
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
              <h2 className="mb-3 text-sm font-semibold">Payment</h2>
              <dl className="flex flex-col gap-2 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Total</span>
                  <span className="tabular-nums">
                    {formatMoney(booking.totalPrice, booking.currency)}
                  </span>
                </div>
                {booking.paymentStatus === "fully_paid" ||
                booking.paymentStatus === "paid" ? (
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Paid in full</span>
                    <span className="tabular-nums">
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
                      <span className="tabular-nums">
                        {formatMoney(booking.depositPaid, booking.currency)}
                      </span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-muted-foreground">Balance due</span>
                      <span className="font-medium tabular-nums">
                        {formatMoney(booking.balanceDue, booking.currency)}
                      </span>
                    </div>
                  </>
                )}
              </dl>
            </div>

            {booking.driver && (
              <div className="rounded-lg border bg-muted/30 p-3">
                <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
                  <CarIcon className="size-4" />
                  Your driver
                </h2>
                <p className="text-sm font-medium">{booking.driver.name}</p>
                <p className="text-xs text-muted-foreground">
                  {booking.driver.vehicleMake} {booking.driver.vehicleModel} ·{" "}
                  <span className="font-mono">{booking.driver.plateNumber}</span>
                </p>
                {booking.driver.whatsappUrl && (
                  <a
                    href={booking.driver.whatsappUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-flex h-7 items-center justify-center gap-1 rounded-lg border bg-background px-2.5 text-[0.8rem] font-medium hover:bg-muted"
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
      <dd className="min-w-0 break-words">{value}</dd>
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
