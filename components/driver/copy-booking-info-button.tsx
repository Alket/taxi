"use client"

import * as React from "react"
import {
  CheckIcon,
  CopyIcon,
  MessageSquareIcon,
  PhoneIcon,
} from "lucide-react"
import { toast } from "sonner"

import {
  buildDriverBookingInfoText,
  type DriverBookingInfoSource,
} from "@/lib/driver-booking-info-copy"
import { useDriverLocale, useDriverT } from "@/lib/i18n/driver"
import { cn } from "@/lib/utils"
import { Button, buttonVariants } from "@/components/ui/button"

function bookingInfoWhatsAppUrl(text: string) {
  return `https://wa.me/?text=${encodeURIComponent(text)}`
}

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
      size="sm"
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

/** Opens WhatsApp with booking info pre-filled so the driver can pick a chat. */
export function WhatsAppBookingInfoButton({
  trip,
  className,
}: {
  trip: DriverBookingInfoSource
  className?: string
}) {
  const t = useDriverT()
  const locale = useDriverLocale()

  function onShare() {
    const text = buildDriverBookingInfoText(trip, t, locale)
    window.open(bookingInfoWhatsAppUrl(text), "_blank", "noopener,noreferrer")
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn("h-9 touch-manipulation", className)}
      onClick={onShare}
    >
      <MessageSquareIcon data-icon="inline-start" />
      {t("trips.whatsappBookingInfo")}
    </Button>
  )
}

export type DriverContactShareTrip = DriverBookingInfoSource & {
  contactPhone: string
  contactWhatsappUrl: string | null
}

/**
 * Phone / WhatsApp / booking-info actions in one muted block —
 * kept visually separate from Arrive / Cash Paid / Complete.
 */
export function DriverContactShareBlock({
  trip,
  className,
}: {
  trip: DriverContactShareTrip
  className?: string
}) {
  const t = useDriverT()
  const hasPhone = Boolean(trip.contactPhone)

  return (
    <div
      className={cn(
        "flex flex-col gap-2.5 rounded-xl border border-border bg-muted/40 p-3",
        className,
      )}
    >
      <p className="text-xs font-medium text-muted-foreground">
        {t("trips.contactShare")}
      </p>
      <div className="flex flex-wrap gap-2">
        {hasPhone ? (
          <a
            href={`tel:${trip.contactPhone}`}
            aria-label={t("trips.callPassenger")}
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "h-9 flex-1 touch-manipulation sm:flex-none",
            )}
          >
            <PhoneIcon data-icon="inline-start" />
            {t("trips.phone")}
          </a>
        ) : null}
        {hasPhone && trip.contactWhatsappUrl ? (
          <a
            href={trip.contactWhatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t("trips.whatsappPassenger")}
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "h-9 flex-1 touch-manipulation sm:flex-none",
            )}
          >
            <MessageSquareIcon data-icon="inline-start" />
            {t("trips.whatsapp")}
          </a>
        ) : null}
        <CopyBookingInfoButton trip={trip} className="flex-1 sm:flex-none" />
        <WhatsAppBookingInfoButton
          trip={trip}
          className="flex-1 sm:flex-none"
        />
      </div>
    </div>
  )
}
