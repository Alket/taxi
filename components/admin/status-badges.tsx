import { cn } from "@/lib/utils"
import {
  BOOKING_STATUS_LABELS,
  FLIGHT_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
} from "@/lib/format"
import type { BookingStatus, FlightStatus, PaymentStatus } from "@/lib/types"

type Tone = "neutral" | "info" | "success" | "warning" | "destructive" | "primary"

const toneClasses: Record<Tone, string> = {
  neutral: "bg-muted text-muted-foreground",
  info: "bg-info/12 text-info",
  success: "bg-success/15 text-success",
  warning: "bg-warning/18 text-warning",
  destructive: "bg-destructive/12 text-destructive",
  primary: "bg-primary/12 text-primary",
}

const dotClasses: Record<Tone, string> = {
  neutral: "bg-muted-foreground",
  info: "bg-info",
  success: "bg-success",
  warning: "bg-warning",
  destructive: "bg-destructive",
  primary: "bg-primary",
}

function ToneBadge({
  tone,
  children,
  dot = true,
  className,
}: {
  tone: Tone
  children: React.ReactNode
  dot?: boolean
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex h-5.5 w-fit items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        toneClasses[tone],
        className,
      )}
    >
      {dot && (
        <span className={cn("size-1.5 shrink-0 rounded-full", dotClasses[tone])} />
      )}
      {children}
    </span>
  )
}

const bookingTone: Record<BookingStatus, Tone> = {
  pending: "warning",
  confirmed: "info",
  driver_assigned: "warning",
  driver_accepted: "primary",
  en_route: "primary",
  arrived: "primary",
  in_progress: "primary",
  completed: "success",
  cancelled: "destructive",
}

export function BookingStatusBadge({ status }: { status: BookingStatus }) {
  return <ToneBadge tone={bookingTone[status]}>{BOOKING_STATUS_LABELS[status]}</ToneBadge>
}

const paymentTone: Record<PaymentStatus, Tone> = {
  unpaid: "destructive",
  deposit_paid: "warning",
  paid: "success",
  fully_paid: "success",
  refunded: "neutral",
  failed: "destructive",
}

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  return <ToneBadge tone={paymentTone[status]}>{PAYMENT_STATUS_LABELS[status]}</ToneBadge>
}

const flightTone: Record<FlightStatus, Tone> = {
  scheduled: "neutral",
  on_time: "success",
  delayed: "warning",
  landed: "info",
  cancelled: "destructive",
}

export function FlightStatusBadge({ status }: { status: FlightStatus }) {
  return (
    <ToneBadge tone={flightTone[status]} dot={false} className="font-normal">
      {FLIGHT_STATUS_LABELS[status]}
    </ToneBadge>
  )
}

export { ToneBadge }
