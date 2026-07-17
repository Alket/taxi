"use client"

import * as React from "react"
import { toast } from "sonner"
import { PlusIcon, TrashIcon } from "lucide-react"

import { apiPatch } from "@/lib/api"
import type { AirportEntry, Settings } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field, PanelCard, SaveButton } from "@/components/settings/shared"

function extract(s: Settings) {
  return {
    airports: s.airports.map((a) => ({ ...a })),
    flightDelayThresholdMinutes: String(s.flightDelayThresholdMinutes),
  }
}

export function FlightTrackingPanel({
  settings,
  onSaved,
}: {
  settings: Settings
  onSaved: () => void
}) {
  const [form, setForm] = React.useState(() => extract(settings))
  const [pending, setPending] = React.useState(false)

  const serverSnapshot = JSON.stringify(extract(settings))
  React.useEffect(() => {
    setForm(extract(settings))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverSnapshot])

  const dirty = JSON.stringify(form) !== serverSnapshot

  function updateAirport(index: number, field: keyof AirportEntry, value: string) {
    setForm((f) => ({
      ...f,
      airports: f.airports.map((a, i) =>
        i === index
          ? { ...a, [field]: field === "iataCode" ? value.toUpperCase().slice(0, 3) : value }
          : a,
      ),
    }))
  }

  function addAirport() {
    setForm((f) => ({ ...f, airports: [...f.airports, { name: "", iataCode: "" }] }))
  }

  function removeAirport(index: number) {
    setForm((f) => ({ ...f, airports: f.airports.filter((_, i) => i !== index) }))
  }

  async function save() {
    const cleaned = form.airports
      .map((a) => ({
        name: a.name.trim(),
        iataCode: a.iataCode.trim().toUpperCase(),
      }))
      .filter((a) => a.name || a.iataCode)

    if (cleaned.some((a) => !a.name || !a.iataCode)) {
      toast.error("Each airport needs both a name and an IATA code.")
      return
    }
    if (cleaned.some((a) => a.iataCode.length !== 3)) {
      toast.error("IATA codes must be exactly 3 letters.")
      return
    }

    setPending(true)
    try {
      await apiPatch("/api/admin/settings", {
        airports: cleaned,
        flightDelayThresholdMinutes: Number(form.flightDelayThresholdMinutes),
      })
      toast.success("Flight tracking settings saved.")
      onSaved()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setPending(false)
    }
  }

  return (
    <PanelCard
      title="Flight Tracking"
      description="Airports served and delay alert thresholds"
      footer={<SaveButton pending={pending} dirty={dirty} onClick={save} />}
    >
      <Field label="Tracked airports">
        <div className="flex flex-col gap-2">
          {form.airports.length === 0 && (
            <p className="rounded-lg border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">
              No airports yet. Add one below.
            </p>
          )}
          {form.airports.map((a, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                value={a.name}
                onChange={(e) => updateAirport(i, "name", e.target.value)}
                placeholder="Airport name"
                className="flex-1"
                aria-label={`Airport ${i + 1} name`}
              />
              <Input
                value={a.iataCode}
                onChange={(e) => updateAirport(i, "iataCode", e.target.value)}
                placeholder="IATA"
                className="w-24 font-mono uppercase"
                aria-label={`Airport ${i + 1} IATA code`}
              />
              <Button
                size="icon-sm"
                variant="ghost"
                onClick={() => removeAirport(i)}
                aria-label={`Remove airport ${i + 1}`}
              >
                <TrashIcon />
              </Button>
            </div>
          ))}
          <Button
            size="sm"
            variant="outline"
            onClick={addAirport}
            className="self-start"
          >
            <PlusIcon data-icon="inline-start" />
            Add airport
          </Button>
        </div>
      </Field>

      <Field
        label="Flight delay threshold (minutes)"
        htmlFor="flightDelayThreshold"
        hint="A flight is flagged as delayed once it exceeds this many minutes."
      >
        <Input
          id="flightDelayThreshold"
          type="number"
          min={5}
          max={600}
          value={form.flightDelayThresholdMinutes}
          onChange={(e) =>
            setForm((f) => ({
              ...f,
              flightDelayThresholdMinutes: e.target.value,
            }))
          }
          className="sm:max-w-48"
        />
      </Field>
    </PanelCard>
  )
}
