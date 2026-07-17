"use client"

import { MapPinIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export type ServiceZonePlace = {
  id: string
  name: string
  lat: number
  lng: number
}

export type ResolvedZonePlace = {
  address: string
  lat: number
  lng: number
  zoneId: string
}

type ZonePlaceSelectProps = {
  id?: string
  label: string
  placeholder?: string
  zones: ServiceZonePlace[]
  /** Currently selected zone id, or null if none. */
  value: string | null
  onResolved: (place: ResolvedZonePlace) => void
  onCleared?: () => void
  disabled?: boolean
  loading?: boolean
  className?: string
}

/** Pickup / destination picker backed by active service zones (Prisma). */
export function ZonePlaceSelect({
  id = "service-zone",
  label,
  placeholder = "Select a service area",
  zones,
  value,
  onResolved,
  onCleared,
  disabled,
  loading,
  className,
}: ZonePlaceSelectProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={id} className="text-sm font-bold text-brand">
        {label}
      </Label>
      <div className="relative">
        <MapPinIcon className="pointer-events-none absolute top-1/2 left-2.5 z-10 size-4 -translate-y-1/2 text-muted-foreground" />
        <Select
          value={value}
          disabled={disabled || loading || zones.length === 0}
          onValueChange={(next) => {
            if (next == null) {
              onCleared?.()
              return
            }
            const zone = zones.find((z) => z.id === next)
            if (!zone) {
              onCleared?.()
              return
            }
            onResolved({
              address: zone.name,
              lat: zone.lat,
              lng: zone.lng,
              zoneId: zone.id,
            })
          }}
        >
          <SelectTrigger id={id} className="w-full pl-8 focus:ring-brand-accent focus:border-brand-accent">
            <SelectValue
              placeholder={
                loading
                  ? "Loading service areas…"
                  : zones.length === 0
                    ? "No service areas available"
                    : placeholder
              }
            >
              {zones.find((zone) => zone.id === value)?.name}
            </SelectValue>
          </SelectTrigger>
          <SelectContent variant="brand">
            {zones.map((zone) => (
              <SelectItem key={zone.id} value={zone.id}>
                {zone.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <p className="text-xs text-muted-foreground">
        Choose from our covered service areas.
      </p>
    </div>
  )
}

/** Match a stored booking location back to a zone id when possible. */
export function matchZoneId(
  zones: ServiceZonePlace[],
  location: { address: string; lat: number | null; lng: number | null },
): string | null {
  if (zones.length === 0) return null

  const byName = zones.find(
    (z) => z.name.toLowerCase() === location.address.trim().toLowerCase(),
  )
  if (byName) return byName.id

  if (location.lat != null && location.lng != null) {
    const byCoords = zones.find(
      (z) =>
        Math.abs(z.lat - location.lat!) < 1e-5 &&
        Math.abs(z.lng - location.lng!) < 1e-5,
    )
    if (byCoords) return byCoords.id
  }

  return null
}
