"use client"

import * as React from "react"
import { MapPinIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export type ResolvedPlace = {
  address: string
  lat: number
  lng: number
}

type AddressAutocompleteProps = {
  id?: string
  label: string
  placeholder?: string
  value: string
  onResolved: (place: ResolvedPlace) => void
  onCleared?: () => void
  disabled?: boolean
  className?: string
}

declare global {
  interface Window {
    google?: typeof google
    __googleMapsPromise?: Promise<void>
  }
}

// TODO: Set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in .env.local
// (Maps JavaScript API + Places API enabled for the key).
const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

function loadGoogleMaps(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google Maps can only load in the browser."))
  }

  if (window.google?.maps?.places) {
    return Promise.resolve()
  }

  if (window.__googleMapsPromise) {
    return window.__googleMapsPromise
  }

  if (!GOOGLE_MAPS_API_KEY) {
    return Promise.reject(new Error("Missing Google Maps API key."))
  }

  window.__googleMapsPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      "script[data-google-maps]",
    )
    if (existing) {
      existing.addEventListener("load", () => resolve())
      existing.addEventListener("error", () =>
        reject(new Error("Failed to load Google Maps.")),
      )
      return
    }

    const script = document.createElement("script")
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places&language=en`
    script.async = true
    script.defer = true
    script.dataset.googleMaps = "true"
    script.onload = () => resolve()
    script.onerror = () => reject(new Error("Failed to load Google Maps."))
    document.head.appendChild(script)
  })

  return window.__googleMapsPromise
}

export function AddressAutocomplete({
  id = "destination-address",
  label,
  placeholder = "Start typing an address…",
  value,
  onResolved,
  onCleared,
  disabled,
  className,
}: AddressAutocompleteProps) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const autocompleteRef = React.useRef<google.maps.places.Autocomplete | null>(
    null,
  )
  const [ready, setReady] = React.useState(false)
  const [loadError, setLoadError] = React.useState<string | null>(null)
  const [text, setText] = React.useState(value)

  const onResolvedRef = React.useRef(onResolved)
  const onClearedRef = React.useRef(onCleared)
  onResolvedRef.current = onResolved
  onClearedRef.current = onCleared

  React.useEffect(() => {
    setText(value)
  }, [value])

  React.useEffect(() => {
    let cancelled = false

    loadGoogleMaps()
      .then(() => {
        if (cancelled || !inputRef.current || !window.google?.maps?.places) {
          return
        }

        // Bias results to Albania.
        const albaniaBounds = new google.maps.LatLngBounds(
          { lat: 39.6, lng: 19.2 },
          { lat: 42.7, lng: 21.1 },
        )

        const autocomplete = new google.maps.places.Autocomplete(
          inputRef.current,
          {
            fields: ["formatted_address", "geometry", "name"],
            componentRestrictions: { country: "al" },
            bounds: albaniaBounds,
            strictBounds: false,
          },
        )

        autocomplete.addListener("place_changed", () => {
          const place = autocomplete.getPlace()
          const loc = place.geometry?.location
          if (!loc) {
            onClearedRef.current?.()
            return
          }

          const address =
            place.formatted_address ||
            place.name ||
            inputRef.current?.value ||
            ""

          onResolvedRef.current({
            address,
            lat: loc.lat(),
            lng: loc.lng(),
          })
        })

        autocompleteRef.current = autocomplete
        setReady(true)
        setLoadError(null)
      })
      .catch((err) => {
        if (!cancelled) {
          setLoadError((err as Error).message)
          setReady(false)
        }
      })

    return () => {
      cancelled = true
      if (autocompleteRef.current && window.google?.maps?.event) {
        google.maps.event.clearInstanceListeners(autocompleteRef.current)
      }
      autocompleteRef.current = null
    }
  }, [])

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <MapPinIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          id={id}
          value={text}
          disabled={disabled || Boolean(loadError)}
          placeholder={placeholder}
          autoComplete="off"
          className="pl-8"
          onChange={(e) => {
            setText(e.target.value)
            onCleared?.()
          }}
        />
      </div>
      {!GOOGLE_MAPS_API_KEY && (
        <p className="text-xs text-amber-700 dark:text-amber-400">
          {/* TODO: Set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in .env.local */}
          Address search needs NEXT_PUBLIC_GOOGLE_MAPS_API_KEY.
        </p>
      )}
      {GOOGLE_MAPS_API_KEY && loadError && (
        <p className="text-xs text-destructive">{loadError}</p>
      )}
      {ready && !loadError && (
        <p className="text-xs text-muted-foreground">
          Pick a suggestion to lock in the location.
        </p>
      )}
    </div>
  )
}
