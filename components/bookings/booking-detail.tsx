"use client"

import * as React from "react"
import useSWR from "swr"
import { toast } from "sonner"
import {
  BanknoteIcon,
  CalendarClockIcon,
  LuggageIcon,
  MailIcon,
  MapPinIcon,
  PencilIcon,
  PhoneIcon,
  PlaneIcon,
  ShieldCheckIcon,
  Trash2Icon,
  TriangleAlertIcon,
  UsersIcon,
} from "lucide-react"

import { apiDelete, apiPatch, apiPost, fetcher } from "@/lib/api"
import { toLocalInputValue } from "@/lib/booking-details"
import {
  parseBookingNotes,
  type BookingNoteTone,
} from "@/lib/booking-notes"
import {
  DIRECTION_LABELS,
  BOOKING_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  VEHICLE_LABELS,
  formatDateTime,
  formatMoney,
} from "@/lib/format"
import { getNextFlowStatus, isBookingLockedForCancel, isBookingLockedForEdit } from "@/lib/booking-status"
import type { Booking, BookingDetail, BookingStatus, VehicleType } from "@/lib/types"
import { cn } from "@/lib/utils"
import { useAdminSession } from "@/hooks/use-admin-session"
import { DirectionIndicator } from "@/components/admin/direction-indicator"
import { AdminDateTimeField } from "@/components/admin/date-field"
import {
  BookingStatusBadge,
  FlightStatusBadge,
  PaymentStatusBadge,
} from "@/components/admin/status-badges"
import { DriverAssign } from "@/components/bookings/driver-assign"
import { StatusTimeline } from "@/components/bookings/status-timeline"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

import { Skeleton } from "@/components/ui/skeleton"

export function BookingDetail({
  bookingId,
  open,
  onOpenChange,
  onMutated,
}: {
  bookingId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onMutated: () => void
}) {
  const { canDelete, isAdmin } = useAdminSession()
  const { data, isLoading, mutate } = useSWR<{ booking: BookingDetail }>(
    bookingId && open ? `/api/admin/bookings/${bookingId}` : null,
    fetcher,
  )

  const booking = data?.booking ?? null

  function handleMutated() {
    void mutate()
    onMutated()
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="h-dvh max-w-none gap-0 rounded-none border-0 p-0 sm:max-w-lg sm:border-l sm:data-[side=right]:max-w-lg"
      >
        {isLoading ? (
          <div className="flex flex-col gap-4 p-4">
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : booking ? (
          <>
            <SheetHeader className="border-b p-4 pr-12">
              <div className="flex items-center gap-2">
                <SheetTitle className="font-mono text-sm">
                  {booking.referenceCode}
                </SheetTitle>
                <BookingStatusBadge status={booking.status} />
              </div>
              <SheetDescription>
                {DIRECTION_LABELS[booking.direction]}
              </SheetDescription>
            </SheetHeader>
            <ScrollArea className="min-h-0 flex-1">
              <div className="flex flex-col gap-6 p-4">
                <RouteBlock booking={booking} />
                <TripFacts booking={booking} />
                <Separator />
                <CustomerBlock booking={booking} />
                <Separator />
                <DriverAssign booking={booking} onAssigned={handleMutated} />
                <StatusAdvanceButtons
                  booking={booking}
                  onAdvanced={handleMutated}
                />
                <Separator />
                <PaymentSection booking={booking} onMutated={handleMutated} />
                <Separator />
                <section className="flex flex-col gap-3">
                  <SectionLabel icon={CalendarClockIcon}>
                    Status timeline
                  </SectionLabel>
                  <StatusTimeline booking={booking} />
                </section>
              </div>
            </ScrollArea>
            {isAdmin ? (
              <div className="flex flex-col gap-2 border-t bg-background/95 p-3 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur sm:p-4">
                <EditBookingSection
                  booking={booking}
                  onMutated={handleMutated}
                />
                <CancelSection booking={booking} onMutated={handleMutated} />
                {canDelete ? (
                  <DeleteBookingSection
                    booking={booking}
                    onDeleted={() => {
                      onOpenChange(false)
                      onMutated()
                    }}
                  />
                ) : null}
              </div>
            ) : null}
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}

function SectionLabel({
  icon: Icon,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>
  children: React.ReactNode
}) {
  return (
    <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
      <Icon className="size-3.5" />
      {children}
    </span>
  )
}

function RouteBlock({ booking }: { booking: Booking }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <DirectionIndicator direction={booking.direction} />
        <FlightStatusBadge status={booking.flightStatus} />
      </div>
      <ol className="flex flex-col gap-3">
        <li className="flex gap-3">
          <div className="flex flex-col items-center pt-1">
            <span className="size-2.5 rounded-full border-2 border-primary" />
            <span className="my-1 w-0.5 flex-1 bg-border" />
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground">Pickup</span>
            <span className="text-sm font-medium">{booking.pickupAddress}</span>
          </div>
        </li>
        <li className="flex gap-3">
          <div className="flex flex-col items-center pt-1">
            <MapPinIcon className="size-3 text-success" />
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground">Drop-off</span>
            <span className="text-sm font-medium">
              {booking.dropoffAddress}
            </span>
          </div>
        </li>
      </ol>
    </section>
  )
}

function TripFacts({ booking }: { booking: Booking }) {
  const facts = [
    {
      icon: CalendarClockIcon,
      label: "Pickup time",
      value: formatDateTime(booking.pickupDateTime),
      fullRow: true,
    },
    {
      icon: PlaneIcon,
      label: "Flight",
      value: booking.flightNumber,
      fullRow: true,
    },
    {
      icon: UsersIcon,
      label: "Passengers",
      value: String(booking.passengerCount),
      fullRow: false,
    },
    {
      icon: LuggageIcon,
      label: "Luggage",
      value: String(booking.luggageCount),
      fullRow: false,
    },
  ]
  return (
    <section className="grid grid-cols-2 gap-3">
      {facts.map((f) => (
        <div
          key={f.label}
          className={cn(
            "flex items-center gap-2.5 rounded-lg border bg-muted/30 p-2.5",
            f.fullRow && "col-span-2",
          )}
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-background text-muted-foreground">
            <f.icon className="size-4" />
          </span>
          <div className="flex min-w-0 flex-col">
            <span className="text-xs text-muted-foreground">{f.label}</span>
            <span className="truncate text-sm font-medium">{f.value}</span>
          </div>
        </div>
      ))}
      <div className="col-span-2 flex items-center gap-2.5 rounded-lg border bg-muted/30 p-2.5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-background text-muted-foreground">
          <MapPinIcon className="size-4" />
        </span>
        <div className="flex min-w-0 flex-col">
          <span className="text-xs text-muted-foreground">Vehicle</span>
          <span className="text-sm font-medium">
            {VEHICLE_LABELS[booking.vehicleType]}
          </span>
        </div>
      </div>
      {booking.notes && (
        <BookingNotesBlock
          notes={booking.notes}
          paymentStatus={booking.paymentStatus}
        />
      )}
    </section>
  )
}

function BookingNotesBlock({
  notes,
  paymentStatus,
}: {
  notes: string
  paymentStatus?: string
}) {
  const items = parseBookingNotes(notes, { paymentStatus })
  if (items.length === 0) return null

  const toneClass: Record<BookingNoteTone, string> = {
    accent: "border-primary/25 bg-primary/5 text-foreground",
    warning: "border-warning/30 bg-warning/10 text-foreground",
    muted: "border-border bg-muted/40 text-foreground",
    default: "border-border bg-background text-foreground",
  }

  return (
    <div className="col-span-2 flex flex-col gap-2">
      <span className="text-xs font-medium text-muted-foreground">
        Booking flags
      </span>
      <ul className="flex flex-col gap-1.5">
        {items.map((item) => (
          <li
            key={item.id}
            className={cn(
              "flex items-start justify-between gap-3 rounded-lg border px-3 py-2",
              toneClass[item.tone],
            )}
          >
            <span className="text-sm font-medium">{item.label}</span>
            {item.detail ? (
              <span className="text-right text-xs text-muted-foreground">
                {item.detail}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  )
}

function CustomerBlock({ booking }: { booking: Booking }) {
  const { customer } = booking
  return (
    <section className="flex flex-col gap-2">
      <SectionLabel icon={UsersIcon}>Customer</SectionLabel>
      <p className="text-sm font-medium">{customer.name}</p>
      <div className="flex flex-col gap-1.5">
        <a
          href={`mailto:${customer.email}`}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <MailIcon className="size-3.5" />
          {customer.email}
        </a>
        <a
          href={`tel:${customer.phone}`}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <PhoneIcon className="size-3.5" />
          {customer.phone}
        </a>
      </div>
    </section>
  )
}

function formatBalanceChargedBy(
  chargedBy: string | null,
  driver: BookingDetail["driver"],
): string | null {
  if (!chargedBy) return null
  if (chargedBy === "admin" || chargedBy.startsWith("admin:")) return "Admin"
  if (chargedBy === "customer") return "Customer"
  if (chargedBy.startsWith("driver:")) {
    const driverId = chargedBy.slice("driver:".length)
    if (driver?.id === driverId && driver.name) return driver.name
    if (driver?.name) return driver.name
    return "Driver"
  }
  return chargedBy
}

function PaymentSection({
  booking,
  onMutated,
}: {
  booking: BookingDetail
  onMutated: () => void
}) {
  const canCharge = booking.status === "completed" && !booking.isBalanceCharged
  const depositOutstanding = booking.depositPaid < booking.depositAmount
  const chargedByLabel = formatBalanceChargedBy(
    booking.balanceChargedBy,
    booking.driver,
  )

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <SectionLabel icon={BanknoteIcon}>Payment</SectionLabel>
        <PaymentStatusBadge status={booking.paymentStatus} />
      </div>
      <div className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-3">
        <PaymentRow
          label="Total price"
          value={formatMoney(booking.totalPrice, booking.currency)}
        />
        {booking.paymentStatus === "fully_paid" ||
        booking.paymentStatus === "paid" ? (
          <PaymentRow
            label="Paid in full"
            value={formatMoney(
              booking.depositPaid || booking.totalPrice,
              booking.currency,
            )}
            tone="success"
          />
        ) : (
          <>
            <PaymentRow
              label="Deposit due"
              value={formatMoney(booking.depositAmount, booking.currency)}
            />
            <PaymentRow
              label="Deposit paid"
              value={formatMoney(booking.depositPaid, booking.currency)}
              tone="success"
            />
            <Separator />
            <PaymentRow
              label="Balance due"
              value={formatMoney(booking.balanceDue, booking.currency)}
              emphasize
              tone={booking.balanceDue > 0 ? "warning" : "muted"}
            />
          </>
        )}
      </div>
      {booking.payments.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-muted-foreground">
            Payment history
          </span>
          <ul className="flex flex-col gap-2">
            {booking.payments.map((payment) => (
              <li
                key={payment.id}
                className="flex items-center justify-between rounded-lg border bg-background px-3 py-2"
              >
                <div className="flex flex-col">
                  <span className="text-sm font-medium capitalize">
                    {payment.type} · {payment.provider}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {PAYMENT_STATUS_LABELS[payment.status]} ·{" "}
                    {formatDateTime(payment.paidAt ?? payment.createdAt)}
                  </span>
                </div>
                <span className="text-sm font-medium tabular-nums">
                  {formatMoney(payment.amount, payment.currency)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {depositOutstanding && (
        <PaymentLinkSection booking={booking} onMutated={onMutated} />
      )}
      <ChargeBalanceDialog
        booking={booking}
        disabled={!canCharge}
        onMutated={onMutated}
      />
      {!canCharge && !booking.isBalanceCharged && (
        <p className="text-xs text-muted-foreground">
          Balance can only be charged once the trip is completed.
        </p>
      )}
      {booking.isBalanceCharged && booking.balanceChargedAt && (
        <p className="text-xs text-muted-foreground">
          Balance charged on {formatDateTime(booking.balanceChargedAt)}
          {chargedByLabel ? ` by ${chargedByLabel}` : ""}.
        </p>
      )}
      {booking.isBalanceCharged && (
        <p className="flex items-center gap-1.5 text-xs text-success">
          <ShieldCheckIcon className="size-3.5" />
          Balance has been charged in full.
        </p>
      )}
    </section>
  )
}

function StatusAdvanceButtons({
  booking,
  onAdvanced,
}: {
  booking: Booking
  onAdvanced: () => void
}) {
  const next = getNextFlowStatus(booking.status as BookingStatus)
  const [pending, setPending] = React.useState(false)

  if (next !== "arrived" && next !== "completed") return null

  async function advance() {
    if (!next) return
    setPending(true)
    try {
      await apiPatch(`/api/admin/bookings/${booking.id}/status`, {
        status: next,
      })
      toast.success(`Status updated to ${BOOKING_STATUS_LABELS[next]}.`)
      onAdvanced()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-muted/20 p-3">
      <p className="text-xs text-muted-foreground">
        {next === "arrived"
          ? "Mark Arrived when the passenger is in the taxi."
          : "Mark Completed after drop-off at the destination."}
      </p>
      <Button
        type="button"
        size="sm"
        disabled={pending}
        onClick={() => void advance()}
      >
        {pending
          ? "Updating…"
          : next === "arrived"
            ? "Mark Arrived"
            : "Mark Completed"}
      </Button>
    </div>
  )
}

function PaymentLinkSection({
  booking,
  onMutated,
  paymentType = "deposit",
}: {
  booking: Booking
  onMutated: () => void
  paymentType?: "deposit" | "balance"
}) {
  const [pending, setPending] = React.useState(false)
  const [paymentUrl, setPaymentUrl] = React.useState<string | null>(null)

  const amount =
    paymentType === "deposit" ? booking.depositAmount : booking.balanceDue
  const title =
    paymentType === "deposit"
      ? "Collect deposit by link"
      : "Collect balance by link"
  const buttonLabel =
    paymentType === "deposit"
      ? "Generate Payment Link"
      : "Send new payment link for remaining balance"

  async function generate() {
    setPending(true)
    try {
      const res = await apiPost<{ url: string }>(
        `/api/admin/bookings/${booking.id}/create-payment-link`,
        { paymentType },
      )
      setPaymentUrl(res.url)
      toast.success("Payment link generated.")
      onMutated()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setPending(false)
    }
  }

  async function copy() {
    if (!paymentUrl) return
    try {
      await navigator.clipboard.writeText(paymentUrl)
      toast.success("Payment link copied.")
    } catch {
      toast.error("Failed to copy payment link.")
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium">{title}</span>
        <span className="text-xs text-muted-foreground">
          Generate a Stripe checkout link for{" "}
          {formatMoney(amount, booking.currency)}.
        </span>
      </div>
      <Button
        className="h-10 w-full touch-manipulation sm:h-8"
        onClick={generate}
        disabled={pending}
        variant={paymentType === "balance" ? "outline" : "default"}
      >
        {pending ? "Generating..." : buttonLabel}
      </Button>
      {paymentUrl && (
        <div className="flex flex-col gap-2 rounded-md border bg-background p-2.5">
          <span className="break-all text-xs text-muted-foreground">
            {paymentUrl}
          </span>
          <div>
            <Button
              variant="outline"
              size="sm"
              className="h-10 w-full touch-manipulation sm:h-8 sm:w-auto"
              onClick={copy}
            >
              Copy Link
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function PaymentRow({
  label,
  value,
  emphasize,
  tone = "muted",
}: {
  label: string
  value: string
  emphasize?: boolean
  tone?: "muted" | "success" | "warning"
}) {
  return (
    <div className="flex items-center justify-between">
      <span
        className={cn(
          "text-sm text-muted-foreground",
          emphasize && "font-medium text-foreground",
        )}
      >
        {label}
      </span>
      <span
        className={cn(
          "text-sm tabular-nums",
          emphasize && "text-base font-semibold",
          tone === "success" && "text-success",
          tone === "warning" && "text-warning",
        )}
      >
        {value}
      </span>
    </div>
  )
}

function ChargeBalanceDialog({
  booking,
  disabled,
  onMutated,
}: {
  booking: Booking
  disabled: boolean
  onMutated: () => void
}) {
  const [open, setOpen] = React.useState(false)
  const [confirmValue, setConfirmValue] = React.useState("")
  const [pending, setPending] = React.useState(false)
  const [showPaymentLinkFallback, setShowPaymentLinkFallback] =
    React.useState(false)

  const requiredAmount = booking.balanceDue.toFixed(2)
  const matches = confirmValue.trim() === requiredAmount

  async function charge() {
    if (!matches) return
    setPending(true)
    setShowPaymentLinkFallback(false)
    try {
      await apiPost(`/api/admin/bookings/${booking.id}/charge-balance`)
      toast.success(
        `Charged ${formatMoney(booking.balanceDue, booking.currency)} to the card on file.`,
      )
      setOpen(false)
      setConfirmValue("")
      onMutated()
    } catch (err) {
      const error = err as Error & { code?: string }
      toast.error(error.message)
      if (
        error.code === "authentication_required" ||
        error.code === "card_declined"
      ) {
        setShowPaymentLinkFallback(true)
      }
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) {
          setConfirmValue("")
          setShowPaymentLinkFallback(false)
        }
      }}
    >
      <Button
        variant="destructive"
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        <BanknoteIcon data-icon="inline-start" />
        Charge balance ({formatMoney(booking.balanceDue, booking.currency)})
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Charge remaining balance</DialogTitle>
          <DialogDescription>
            This charges the customer&apos;s card on file for the outstanding
            balance. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Amount to charge</span>
            <span className="text-base font-semibold tabular-nums text-destructive">
              {formatMoney(booking.balanceDue, booking.currency)}
            </span>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="confirm-amount" className="text-xs">
              Type{" "}
              <span className="font-mono font-semibold text-foreground">
                {requiredAmount}
              </span>{" "}
              to confirm
            </Label>
            <Input
              id="confirm-amount"
              inputMode="decimal"
              value={confirmValue}
              onChange={(e) => setConfirmValue(e.target.value)}
              placeholder={requiredAmount}
              autoComplete="off"
            />
          </div>
        </div>
        {showPaymentLinkFallback && (
          <PaymentLinkSection
            booking={booking}
            onMutated={onMutated}
            paymentType="balance"
          />
        )}
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
          <Button
            variant="destructive"
            disabled={!matches || pending}
            onClick={charge}
          >
            {pending ? "Charging..." : "Charge card now"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const VEHICLE_TYPES = Object.keys(VEHICLE_LABELS) as VehicleType[]

function EditBookingSection({
  booking,
  onMutated,
}: {
  booking: BookingDetail
  onMutated: () => void
}) {
  const [open, setOpen] = React.useState(false)
  const [pending, setPending] = React.useState(false)
  const [form, setForm] = React.useState({
    pickupAddress: booking.pickupAddress,
    dropoffAddress: booking.dropoffAddress,
    pickupDateTime: toLocalInputValue(booking.pickupDateTime),
    flightNumber: booking.flightNumber || "",
    passengerCount: String(booking.passengerCount),
    luggageCount: String(booking.luggageCount),
    vehicleType: booking.vehicleType,
    totalPrice: String(booking.totalPrice),
    depositAmount: String(booking.depositAmount),
    notes: booking.notes || "",
  })

  React.useEffect(() => {
    if (!open) return
    setForm({
      pickupAddress: booking.pickupAddress,
      dropoffAddress: booking.dropoffAddress,
      pickupDateTime: toLocalInputValue(booking.pickupDateTime),
      flightNumber: booking.flightNumber || "",
      passengerCount: String(booking.passengerCount),
      luggageCount: String(booking.luggageCount),
      vehicleType: booking.vehicleType,
      totalPrice: String(booking.totalPrice),
      depositAmount: String(booking.depositAmount),
      notes: booking.notes || "",
    })
  }, [open, booking])

  if (isBookingLockedForEdit(booking.status)) return null

  async function save() {
    setPending(true)
    try {
      await apiPatch(`/api/admin/bookings/${booking.id}`, {
        pickupAddress: form.pickupAddress,
        dropoffAddress: form.dropoffAddress,
        pickupDateTime: new Date(form.pickupDateTime).toISOString(),
        flightNumber: form.flightNumber,
        passengerCount: Number(form.passengerCount),
        luggageCount: Number(form.luggageCount),
        vehicleType: form.vehicleType,
        totalPrice: Number(form.totalPrice),
        depositAmount: Number(form.depositAmount),
        notes: form.notes.trim() || null,
      })
      toast.success("Booking updated.")
      setOpen(false)
      onMutated()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      <Button variant="outline" className="w-full" onClick={() => setOpen(true)}>
        <PencilIcon data-icon="inline-start" />
        Edit booking
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="flex h-dvh max-w-none flex-col gap-0 rounded-none border-0 p-0 sm:max-w-lg sm:border-l sm:data-[side=right]:max-w-lg"
        >
          <SheetHeader className="shrink-0 border-b p-4 pr-12 text-left">
            <SheetTitle>Edit booking</SheetTitle>
            <SheetDescription>
              Update trip details and pricing for {booking.referenceCode}.
            </SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">
                  Pickup address
                </Label>
                <Input
                  className="h-11 text-base md:h-9 md:text-sm"
                  value={form.pickupAddress}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, pickupAddress: e.target.value }))
                  }
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">
                  Drop-off address
                </Label>
                <Input
                  className="h-11 text-base md:h-9 md:text-sm"
                  value={form.dropoffAddress}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, dropoffAddress: e.target.value }))
                  }
                />
              </div>
              <AdminDateTimeField
                label="Pickup time"
                value={form.pickupDateTime}
                onChange={(pickupDateTime) =>
                  setForm((f) => ({ ...f, pickupDateTime }))
                }
              />
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">Flight</Label>
                <Input
                  className="h-11 text-base md:h-9 md:text-sm"
                  value={form.flightNumber}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, flightNumber: e.target.value }))
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs text-muted-foreground">
                    Passengers
                  </Label>
                  <Input
                    type="number"
                    min={1}
                    inputMode="numeric"
                    className="h-11 text-base md:h-9 md:text-sm"
                    value={form.passengerCount}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, passengerCount: e.target.value }))
                    }
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs text-muted-foreground">Luggage</Label>
                  <Input
                    type="number"
                    min={0}
                    inputMode="numeric"
                    className="h-11 text-base md:h-9 md:text-sm"
                    value={form.luggageCount}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, luggageCount: e.target.value }))
                    }
                  />
                </div>
                <div className="col-span-2 flex flex-col gap-1.5 sm:col-span-1">
                  <Label className="text-xs text-muted-foreground">Vehicle</Label>
                  <select
                    className="h-11 rounded-lg border border-input bg-transparent px-2.5 text-base md:h-9 md:text-sm"
                    value={form.vehicleType}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        vehicleType: e.target.value as VehicleType,
                      }))
                    }
                  >
                    {VEHICLE_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {VEHICLE_LABELS[type]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs text-muted-foreground">
                    Total price
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    inputMode="decimal"
                    className="h-11 text-base md:h-9 md:text-sm"
                    value={form.totalPrice}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, totalPrice: e.target.value }))
                    }
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs text-muted-foreground">Deposit</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    inputMode="decimal"
                    className="h-11 text-base md:h-9 md:text-sm"
                    value={form.depositAmount}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, depositAmount: e.target.value }))
                    }
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">Notes</Label>
                <Input
                  className="h-11 text-base md:h-9 md:text-sm"
                  value={form.notes}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, notes: e.target.value }))
                  }
                />
              </div>
            </div>
          </div>
          <div className="flex shrink-0 flex-col gap-2 border-t bg-background p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              className="h-11 w-full touch-manipulation sm:h-9 sm:w-auto"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              className="h-11 w-full touch-manipulation sm:h-9 sm:w-auto"
              onClick={() => void save()}
              disabled={pending}
            >
              {pending ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}

function DeleteBookingSection({
  booking,
  onDeleted,
}: {
  booking: Booking
  onDeleted: () => void
}) {
  const [open, setOpen] = React.useState(false)
  const [pending, setPending] = React.useState(false)

  async function remove() {
    setPending(true)
    try {
      await apiDelete(`/api/admin/bookings/${booking.id}`)
      toast.success(`Booking ${booking.referenceCode} deleted.`)
      setOpen(false)
      onDeleted()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setPending(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <Button
        variant="outline"
        className="w-full border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
        onClick={() => setOpen(true)}
      >
        <Trash2Icon data-icon="inline-start" />
        Delete booking
      </Button>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this booking?</AlertDialogTitle>
          <AlertDialogDescription>
            Permanently delete{" "}
            <span className="font-mono font-medium text-foreground">
              {booking.referenceCode}
            </span>
            . Payments and status history for this booking will also be removed.
            Prefer cancel if you only need to stop the trip.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep booking</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={pending}
            onClick={() => void remove()}
          >
            {pending ? "Deleting…" : "Delete permanently"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function CancelSection({
  booking,
  onMutated,
}: {
  booking: Booking
  onMutated: () => void
}) {
  const [open, setOpen] = React.useState(false)
  const [pending, setPending] = React.useState(false)

  const terminal = isBookingLockedForCancel(booking.status)
  const withinFreeWindow =
    new Date(booking.freeCancellationUntil).getTime() > Date.now()

  async function cancel() {
    if (terminal) return
    setPending(true)
    try {
      const res = await apiPatch<{
        freeCancellation: boolean
        depositForfeited: boolean
      }>(`/api/admin/bookings/${booking.id}/cancel`)
      toast.success(
        res.freeCancellation
          ? "Booking cancelled. Deposit refunded (free cancellation)."
          : "Booking cancelled. Deposit forfeited (outside free window).",
      )
      setOpen(false)
      onMutated()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setPending(false)
    }
  }

  if (booking.status === "cancelled") {
    return (
      <p className="flex items-center justify-center gap-1.5 text-sm text-destructive">
        <TriangleAlertIcon className="size-4" />
        This booking has been cancelled.
      </p>
    )
  }

  if (terminal) {
    return (
      <p className="text-center text-sm text-muted-foreground">
        Cancellation is locked after the driver has arrived.
      </p>
    )
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <Button
        variant="destructive"
        className="w-full"
        onClick={() => setOpen(true)}
      >
        Cancel booking
      </Button>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel this booking?</AlertDialogTitle>
          <AlertDialogDescription>
            {withinFreeWindow ? (
              <>
                This booking is{" "}
                <span className="font-medium text-success">
                  within the free-cancellation window
                </span>
                . The deposit will be refunded to the customer.
              </>
            ) : (
              <>
                This booking is{" "}
                <span className="font-medium text-destructive">
                  outside the free-cancellation window
                </span>
                . The deposit will not be refunded.
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep booking</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={pending}
            onClick={cancel}
          >
            {pending ? "Cancelling..." : "Cancel booking"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
