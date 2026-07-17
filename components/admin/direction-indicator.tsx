import { PlaneLanding, PlaneTakeoff } from "lucide-react"
import { cn } from "@/lib/utils"
import { DIRECTION_LABELS } from "@/lib/format"
import type { Direction } from "@/lib/types"

export function DirectionIndicator({
  direction,
  showLabel = false,
  className,
}: {
  direction: Direction
  showLabel?: boolean
  className?: string
}) {
  const Icon = direction === "airport_to_dest" ? PlaneLanding : PlaneTakeoff
  return (
    <span
      className={cn("inline-flex items-center gap-2 text-sm", className)}
      title={DIRECTION_LABELS[direction]}
    >
      <span className="flex size-7 items-center justify-center rounded-md bg-accent text-accent-foreground">
        <Icon className="size-4" />
        <span className="sr-only">{DIRECTION_LABELS[direction]}</span>
      </span>
      {showLabel && (
        <span className="text-muted-foreground">{DIRECTION_LABELS[direction]}</span>
      )}
    </span>
  )
}
