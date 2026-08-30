"use client"

import * as React from "react"
import { CheckIcon, CopyIcon } from "lucide-react"
import { toast } from "sonner"

import {
  buildDriverBookingInfoText,
  type DriverBookingInfoSource,
} from "@/lib/driver-booking-info-copy"
import { useDriverLocale, useDriverT } from "@/lib/i18n/driver"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

export function CopyBookingInfoButton({
  trip,
  className,
}: {
  trip: DriverBookingInfoSource
  className?: string
}) {
  const t = useDriverT()
  const locale = useDriverLocale()
  const [copied, setCopied] = React.useState(false)

  async function onCopy() {
    const text = buildDriverBookingInfoText(trip, t, locale)
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      toast.success(t("trips.copyToastOk"))
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error(t("trips.copyToastFail"))
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="lg"
      className={cn("h-9 touch-manipulation", className)}
      onClick={onCopy}
    >
      {copied ? (
        <CheckIcon data-icon="inline-start" />
      ) : (
        <CopyIcon data-icon="inline-start" />
      )}
      {t("trips.copyBookingInfo")}
    </Button>
  )
}
