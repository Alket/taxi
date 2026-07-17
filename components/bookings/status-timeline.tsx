import { Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { BOOKING_STATUS_FLOW } from "@/lib/booking-status"
import { BOOKING_STATUS_LABELS, formatDateTime } from "@/lib/format"
import type { Booking } from "@/lib/types"

export function StatusTimeline({ booking }: { booking: Booking }) {
  const cancelled = booking.status === "cancelled"
  const timestamps = new Map(
    booking.timeline.map((e) => [e.status, e.timestamp]),
  )

  if (cancelled) {
    const reached = booking.timeline.filter((e) => e.status !== "cancelled")
    return (
      <ol className="flex flex-col">
        {reached.map((e) => (
          <TimelineRow
            key={e.status}
            label={BOOKING_STATUS_LABELS[e.status]}
            timestamp={e.timestamp}
            state="done"
          />
        ))}
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

  return (
    <ol className="flex flex-col">
      {BOOKING_STATUS_FLOW.map((status, i) => {
        const state =
          i < currentIndex ? "done" : i === currentIndex ? "current" : "upcoming"
        return (
          <TimelineRow
            key={status}
            label={BOOKING_STATUS_LABELS[status]}
            timestamp={timestamps.get(status) ?? null}
            state={state}
            last={i === BOOKING_STATUS_FLOW.length - 1}
          />
        )
      })}
    </ol>
  )
}

function TimelineRow({
  label,
  timestamp,
  state,
  last = false,
}: {
  label: string
  timestamp: string | null
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
          {timestamp ? formatDateTime(timestamp) : "Pending"}
        </p>
      </div>
    </li>
  )
}
