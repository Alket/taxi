import type {
  BookingStatus,
  Direction,
  FlightStatus,
  PaymentStatus,
  VehicleType,
} from "@/lib/types"

export function formatMoney(amount: number, currency = "EUR"): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
  }).format(amount)
}

export function formatDateTime(value: string | null): string {
  if (!value) return "—"
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}

export function formatTime(value: string | null): string {
  if (!value) return "—"
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}

export function formatRelative(value: string): string {
  const diffMs = new Date(value).getTime() - Date.now()
  const diffMin = Math.round(diffMs / 60000)
  const abs = Math.abs(diffMin)
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" })
  if (abs < 60) return rtf.format(diffMin, "minute")
  const diffHr = Math.round(diffMin / 60)
  if (Math.abs(diffHr) < 24) return rtf.format(diffHr, "hour")
  return rtf.format(Math.round(diffHr / 24), "day")
}

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  driver_assigned: "Awaiting acceptance",
  driver_accepted: "Driver accepted",
  en_route: "En Route",
  /** Passenger boarded / trip underway. */
  arrived: "Arrived",
  in_progress: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
}

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  unpaid: "Unpaid",
  deposit_paid: "Deposit Paid",
  paid: "Paid in Full",
  fully_paid: "Paid in Full",
  refunded: "Refunded",
  failed: "Payment Failed",
}

export const FLIGHT_STATUS_LABELS: Record<FlightStatus, string> = {
  scheduled: "Scheduled",
  on_time: "On Time",
  delayed: "Delayed",
  landed: "Landed",
  cancelled: "Cancelled",
}

export const VEHICLE_LABELS: Record<VehicleType, string> = {
  sedan: "Sedan",
  comfort: "Comfort",
  minivan: "Minivan",
  premium: "Premium",
}

export const DIRECTION_LABELS: Record<Direction, string> = {
  airport_to_dest: "Airport → Destination",
  dest_to_airport: "Destination → Airport",
}
