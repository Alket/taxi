"use client"

import * as React from "react"
import { CheckIcon, CopyIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

function CopyableValue({
  label,
  value,
  successMessage,
  errorMessage,
  emphasize,
}: {
  label: string
  value: string
  successMessage: string
  errorMessage: string
  emphasize?: boolean
}) {
  const [copied, setCopied] = React.useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      toast.success(successMessage)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error(errorMessage)
    }
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <p className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
        {label}
      </p>
      <p
        className={cn(
          "font-mono font-bold tracking-tight text-brand",
          emphasize ? "text-4xl sm:text-5xl" : "text-2xl sm:text-3xl",
        )}
      >
        {value}
      </p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="rounded-full border-border/80 px-4 text-xs font-bold transition-all duration-200 hover:border-brand-accent/50 hover:bg-brand-accent/5 hover:text-brand-accent active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
        onClick={() => void copy()}
      >
        {copied ? (
          <>
            <CheckIcon data-icon="inline-start" className="size-3.5 text-brand-accent" />
            <span>Copied</span>
          </>
        ) : (
          <>
            <CopyIcon data-icon="inline-start" className="size-3.5" />
            <span>Copy</span>
          </>
        )}
      </Button>
    </div>
  )
}

export function CopyableReference({
  referenceCode,
  pickupPin,
  className,
}: {
  referenceCode: string
  pickupPin?: string
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-5 rounded-2xl border border-border/80 bg-brand-surface px-6 py-6 shadow-xs",
        className,
      )}
    >
      {pickupPin ? (
        <>
          <CopyableValue
            label="Your pickup PIN"
            value={pickupPin}
            successMessage="Pickup PIN copied."
            errorMessage="Could not copy pickup PIN."
            emphasize
          />
          <div className="h-px w-full bg-border" />
          <CopyableValue
            label="Booking reference"
            value={referenceCode}
            successMessage="Reference code copied."
            errorMessage="Could not copy reference code."
          />
        </>
      ) : (
        <CopyableValue
          label="Booking reference"
          value={referenceCode}
          successMessage="Reference code copied."
          errorMessage="Could not copy reference code."
          emphasize
        />
      )}
    </div>
  )
}
