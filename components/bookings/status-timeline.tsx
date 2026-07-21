import { Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { BOOKING_STATUS_FLOW } from "@/lib/booking-status"
import { getDriverCashPaidEvent } from "@/lib/bookings"
import { BOOKING_STATUS_LABELS, formatDateTime } from "@/lib/format"
import type { BookingDetail, BookingStatus } from "@/lib/types"

const CASH_PAID_LABEL = "Cash paid"

type CashPaidEvent = {
  timestamp: string
  recordedBy: string | null
}

type TimelineItem =
  | { kind: "status"; status: BookingStatus; timestamp?: string | null }
  | { kind: "cash_paid"; event: CashPaidEvent }

function insertCashPaidBeforeCompleted(
  items: TimelineItem[],
  cashPaid: CashPaidEvent | null,
): TimelineItem[] {
  if (!cashPaid) return items

  const completedIndex = items.findIndex(
    (item) => item.kind === "status" && item.status === "completed",
  )

  if (completedIndex >= 0) {
    return [
      ...items.slice(0, completedIndex),
      { kind: "cash_paid", event: cashPaid },
      ...items.slice(completedIndex),
    ]
  }

  return [...items, { kind: "cash_paid", event: cashPaid }]
}

export function StatusTimeline({ booking }: { booking: BookingDetail }) {
  const cashPaid = getDriverCashPaidEvent(booking)
  const cancelled = booking.status === "cancelled"
  const timestamps = new Map(
    booking.timeline.map((e) => [e.status, e.timestamp]),
  )

  if (cancelled) {
    const reached = booking.timeline.filter((e) => e.status !== "cancelled")
    const items = insertCashPaidBeforeCompleted(
      reached.map((e) => ({
        kind: "status" as const,
        status: e.status,
        timestamp: e.timestamp,
      })),
      cashPaid,
    )

    return (
      <ol className="flex flex-col">
        {items.map((item) =>
          item.kind === "cash_paid" ? (
            <TimelineRow
              key="cash_paid"
              label={CASH_PAID_LABEL}
              timestamp={item.event.timestamp}
              detail={
                item.event.recordedBy
                  ? `by ${item.event.recordedBy}`
                  : undefined
              }
              state="done"
              last={false}
            />
          ) : (
            <TimelineRow
              key={item.status}
              label={BOOKING_STATUS_LABELS[item.status]}
              timestamp={item.timestamp ?? null}
              state="done"
              last={false}
            />
          ),
        )}
        <TimelineRow
          label={BOOKING_STATUS_LABELS.cancelled}
          timestamp={
            timestamps.get("cancelled") ?? booking.cancelledAt ?? null
          }
          state="cancelled"
          last
        />
      </ol>
    )
  }

  const currentIndex = BOOKING_STATUS_FLOW.indexOf(booking.status)
  const items = insertCashPaidBeforeCompleted(
    BOOKING_STATUS_FLOW.map((status) => ({
      kind: "status" as const,
      status,
    })),
    cashPaid,
  )

  return (
    <ol className="flex flex-col">
      {items.map((item, index) => {
        const last = index === items.length - 1

        if (item.kind === "cash_paid") {
          return (
            <TimelineRow
              key="cash_paid"
              label={CASH_PAID_LABEL}
              timestamp={item.event.timestamp}
              detail={
                item.event.recordedBy
                  ? `by ${item.event.recordedBy}`
                  : undefined
              }
              state="done"
              last={last}
            />
          )
        }

        const statusIndex = BOOKING_STATUS_FLOW.indexOf(item.status)
        const state =
          statusIndex < currentIndex
            ? "done"
            : statusIndex === currentIndex
              ? "current"
              : "upcoming"

        return (
          <TimelineRow
            key={item.status}
            label={BOOKING_STATUS_LABELS[item.status]}
            timestamp={timestamps.get(item.status) ?? null}
            state={state}
            last={last}
          />
        )
      })}
    </ol>
  )
}

function TimelineRow({
  label,
  timestamp,
  detail,
  state,
  last = false,
}: {
  label: string
  timestamp: string | null
  detail?: string
  state: "done" | "current" | "upcoming" | "cancelled"
  last?: boolean
}) {
  return (
    <li className="flex gap-3">
      <div className="flex flex-col items-center">
        <span
          className={cn(
            "flex size-5 shrink-0 items-center justify-center rounded-full border-2",
            state === "done" && "border-success bg-success text-success-foreground",
            state === "current" && "border-primary bg-primary text-primary-foreground",
            state === "upcoming" && "border-border bg-background",
            state === "cancelled" &&
              "border-destructive bg-destructive/10 text-destructive",
          )}
        >
          {state === "done" && <Check className="size-3" />}
          {state === "current" && (
            <span className="size-1.5 rounded-full bg-current" />
          )}
          {state === "cancelled" && (
            <span className="text-[10px] font-bold leading-none">×</span>
          )}
        </span>
        {!last && (
          <span
            className={cn(
              "w-0.5 flex-1",
              state === "done" ? "bg-success/40" : "bg-border",
            )}
          />
        )}
      </div>
      <div className={cn("pb-5", last && "pb-0")}>
        <p
          className={cn(
            "text-sm leading-5",
            state === "upcoming"
              ? "text-muted-foreground"
              : "font-medium text-foreground",
          )}
        >
          {label}
        </p>
        <p className="text-xs text-muted-foreground">
          {timestamp ? (
            <>
              {formatDateTime(timestamp)}
              {detail ? ` · ${detail}` : null}
            </>
          ) : (
            detail ?? "Pending"
          )}
        </p>
      </div>
    </li>
  )
}
