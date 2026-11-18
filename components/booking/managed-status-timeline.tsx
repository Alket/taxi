"use client"

import { Check, X } from "lucide-react"

import { BOOKING_STATUS_FLOW } from "@/lib/booking-status"
import { BOOKING_STATUS_LABELS, formatDateTime } from "@/lib/format"
import type { BookingStatus } from "@/lib/types"
import { cn } from "@/lib/utils"

type TimelineEvent = {
  status: BookingStatus
  timestamp: string | null
}

export function ManagedStatusTimeline({
  status,
  timeline,
  cancelledAt,
}: {
  status: BookingStatus
  timeline: TimelineEvent[]
  cancelledAt: string | null
}) {
  const cancelled = status === "cancelled"
  const timestamps = new Map(timeline.map((e) => [e.status, e.timestamp]))

  if (cancelled) {
    const reached = timeline.filter((e) => e.status !== "cancelled")
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
          timestamp={timestamps.get("cancelled") ?? cancelledAt}
          state="cancelled"
          last
        />
      </ol>
    )
  }

  const currentIndex = BOOKING_STATUS_FLOW.indexOf(status)

  return (
    <ol className="flex flex-col">
      {BOOKING_STATUS_FLOW.map((step, i) => {
        const state =
          i < currentIndex ? "done" : i === currentIndex ? "current" : "upcoming"
        return (
          <TimelineRow
            key={step}
            label={BOOKING_STATUS_LABELS[step]}
            timestamp={timestamps.get(step) ?? null}
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
    <li className="flex gap-3.5">
      <div className="flex flex-col items-center">
        <span
          className={cn(
            "flex size-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
            state === "done" &&
              "border-brand-accent bg-brand-accent text-white shadow-xs",
            state === "current" &&
              "border-brand-accent bg-brand-accent/10 text-brand-accent ring-4 ring-brand-accent/20",
            state === "upcoming" && "border-border/80 bg-brand-surface text-muted-foreground",
            state === "cancelled" &&
              "border-destructive bg-destructive/10 text-destructive",
          )}
        >
          {state === "done" && <Check className="size-3.5 stroke-[2.5]" />}
          {state === "current" && (
            <span className="size-2 rounded-full bg-brand-accent" />
          )}
          {state === "cancelled" && <X className="size-3.5 stroke-[2.5]" />}
        </span>
        {!last && (
          <span
            className={cn(
              "my-1 w-0.5 flex-1 min-h-[1.5rem]",
              state === "done" ? "bg-brand-accent/40" : "bg-border/80",
            )}
          />
        )}
      </div>
      <div className={cn("min-w-0 pb-6", last && "pb-0")}>
        <p
          className={cn(
            "text-sm leading-5",
            state === "upcoming"
              ? "text-muted-foreground"
              : state === "current"
                ? "font-extrabold text-brand"
                : "font-bold text-brand",
          )}
        >
          {label}
        </p>
        {timestamp ? (
          <p className="mt-0.5 text-xs font-medium text-muted-foreground">
            {formatDateTime(timestamp)}
          </p>
        ) : null}
      </div>
    </li>
  )
}
