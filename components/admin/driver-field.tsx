"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { UserIcon, XIcon } from "lucide-react"

import { useIsMobile } from "@/hooks/use-mobile"
import type { Driver } from "@/lib/types"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

export type DriverFilterValue = "all" | "unassigned" | string

type DriverOption = {
  value: DriverFilterValue
  label: string
  description?: string | null
  disabled?: boolean
}

function DesktopPanel({
  open,
  onClose,
  anchorRef,
  children,
  className,
}: {
  open: boolean
  onClose: () => void
  anchorRef: React.RefObject<HTMLElement | null>
  children: React.ReactNode
  className?: string
}) {
  const [mounted, setMounted] = React.useState(false)
  const [pos, setPos] = React.useState({ top: 0, left: 0, width: 280 })

  React.useEffect(() => {
    setMounted(true)
  }, [])

  React.useLayoutEffect(() => {
    if (!open || !anchorRef.current) return

    function place() {
      const el = anchorRef.current
      if (!el) return
      const r = el.getBoundingClientRect()
      const width = Math.min(320, Math.max(240, r.width))
      let left = r.left
      left = Math.min(left, window.innerWidth - width - 12)
      left = Math.max(12, left)
      let top = r.bottom + 6
      const estimatedHeight = 360
      if (top + estimatedHeight > window.innerHeight - 12) {
        top = Math.max(12, r.top - estimatedHeight - 6)
      }
      setPos({ top, left, width })
    }

    place()
    window.addEventListener("resize", place)
    window.addEventListener("scroll", place, true)
    return () => {
      window.removeEventListener("resize", place)
      window.removeEventListener("scroll", place, true)
    }
  }, [open, anchorRef])

  if (!open || !mounted) return null

  return createPortal(
    <>
      <button
        type="button"
        className="fixed inset-0 z-[180] cursor-default"
        aria-label="Close driver list"
        onClick={onClose}
      />
      <div
        style={{ top: pos.top, left: pos.left, width: pos.width }}
        className={cn(
          "fixed z-[190] rounded-xl border bg-popover p-2 text-popover-foreground shadow-lg ring-1 ring-foreground/10",
          className,
        )}
      >
        {children}
      </div>
    </>,
    document.body,
  )
}

function buildDriverOptions(
  drivers: Driver[],
  {
    includeAll,
    includeUnassigned,
    getOptionLabel,
    getOptionDescription,
    isOptionDisabled,
  }: {
    includeAll: boolean
    includeUnassigned: boolean
    getOptionLabel?: (driver: Driver) => string
    getOptionDescription?: (driver: Driver) => string | null | undefined
    isOptionDisabled?: (driver: Driver) => boolean
  },
): DriverOption[] {
  const options: DriverOption[] = []
  if (includeAll) options.push({ value: "all", label: "All drivers" })
  if (includeUnassigned) {
    options.push({ value: "unassigned", label: "Unassigned" })
  }
  for (const driver of drivers) {
    options.push({
      value: driver.id,
      label: getOptionLabel?.(driver) ?? driver.name,
      description: getOptionDescription?.(driver) ?? null,
      disabled: isOptionDisabled?.(driver) ?? false,
    })
  }
  return options
}

export function resolveDriverFilterLabel(
  value: DriverFilterValue,
  drivers: Driver[],
  fallbackLabel?: string | null,
  placeholder = "All drivers",
): string {
  if (!value || value === "all") return placeholder
  if (value === "unassigned") return "Unassigned"
  const match = drivers.find((driver) => driver.id === value)
  if (match) return match.name
  if (fallbackLabel) return fallbackLabel
  return placeholder
}

type AdminDriverFieldProps = {
  label: string
  value: DriverFilterValue
  onChange: (value: DriverFilterValue) => void
  drivers: Driver[]
  placeholder?: string
  fallbackLabel?: string | null
  className?: string
  allowClear?: boolean
  /** Include the “All drivers” option (default true for filters). */
  includeAll?: boolean
  /** Include the “Unassigned” option (default true for filters). */
  includeUnassigned?: boolean
  getOptionLabel?: (driver: Driver) => string
  getOptionDescription?: (driver: Driver) => string | null | undefined
  isOptionDisabled?: (driver: Driver) => boolean
  onDisabledSelect?: (driver: Driver) => void
  emptyMessage?: string
  disabled?: boolean
}

/**
 * Driver picker styled like AdminDateField — shows names, not IDs.
 */
export function AdminDriverField({
  label,
  value,
  onChange,
  drivers,
  placeholder = "All drivers",
  fallbackLabel,
  className,
  allowClear = true,
  includeAll = true,
  includeUnassigned = true,
  getOptionLabel,
  getOptionDescription,
  isOptionDisabled,
  onDisabledSelect,
  emptyMessage = "No drivers found.",
  disabled = false,
}: AdminDriverFieldProps) {
  const isMobile = useIsMobile()
  const [open, setOpen] = React.useState(false)
  const triggerRef = React.useRef<HTMLDivElement>(null)

  const options = React.useMemo(
    () =>
      buildDriverOptions(drivers, {
        includeAll,
        includeUnassigned,
        getOptionLabel,
        getOptionDescription,
        isOptionDisabled,
      }),
    [
      drivers,
      includeAll,
      includeUnassigned,
      getOptionLabel,
      getOptionDescription,
      isOptionDisabled,
    ],
  )
  const display = resolveDriverFilterLabel(
    value,
    drivers,
    fallbackLabel,
    placeholder,
  )
  const clearValue: DriverFilterValue = includeAll ? "all" : ""
  const showClear =
    allowClear && value !== "all" && value !== "" && Boolean(value)

  const list = (
    <div className="flex max-h-64 flex-col gap-0.5 overflow-y-auto overscroll-contain">
      {options.length === 0 ? (
        <p className="px-3 py-6 text-center text-sm text-muted-foreground">
          {emptyMessage}
        </p>
      ) : (
        options.map((option) => (
          <Button
            key={option.value}
            type="button"
            variant={value === option.value ? "secondary" : "ghost"}
            disabled={option.disabled}
            className={cn(
              "h-auto min-h-10 w-full touch-manipulation justify-start px-3 py-2 text-left font-normal md:min-h-9 md:text-sm",
              value === option.value && "font-medium",
              option.disabled && "opacity-60",
            )}
            onClick={() => {
              if (option.disabled) {
                const driver = drivers.find((d) => d.id === option.value)
                if (driver) onDisabledSelect?.(driver)
                return
              }
              onChange(option.value)
              setOpen(false)
            }}
          >
            <span className="flex min-w-0 flex-col items-start gap-0.5">
              <span className="truncate">{option.label}</span>
              {option.description ? (
                <span className="truncate text-xs text-muted-foreground">
                  {option.description}
                </span>
              ) : null}
            </span>
          </Button>
        ))
      )}
    </div>
  )

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label ? (
        <span className="text-xs text-muted-foreground">{label}</span>
      ) : null}
      <div ref={triggerRef} className="flex gap-1.5">
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "h-11 min-w-0 flex-1 touch-manipulation justify-start gap-2 px-3 text-left font-normal md:h-10",
            (value === "all" || !value) && "text-muted-foreground",
          )}
          onClick={() => setOpen((current) => !current)}
        >
          <UserIcon className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate text-base md:text-sm">{display}</span>
        </Button>
        {showClear ? (
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-11 shrink-0 touch-manipulation md:size-10"
            aria-label={`Clear ${label}`}
            disabled={disabled}
            onClick={() => onChange(clearValue)}
          >
            <XIcon className="size-4" />
          </Button>
        ) : null}
      </div>

      {!isMobile ? (
        <DesktopPanel
          open={open}
          onClose={() => setOpen(false)}
          anchorRef={triggerRef}
        >
          {list}
        </DesktopPanel>
      ) : (
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent
            side="bottom"
            className="max-h-[min(92dvh,40rem)] gap-0 rounded-t-2xl p-0"
          >
            <SheetHeader className="border-b p-4 pr-12 text-left">
              <SheetTitle className="text-base">
                {label || "Select driver"}
              </SheetTitle>
            </SheetHeader>
            <div className="overflow-y-auto overscroll-contain p-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
              {list}
            </div>
          </SheetContent>
        </Sheet>
      )}
    </div>
  )
}
