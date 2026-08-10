"use client"

import * as React from "react"
import { toast } from "sonner"

import { apiPatch } from "@/lib/api"
import type { Settings } from "@/lib/types"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Field, PanelCard, SaveButton } from "@/components/settings/shared"

function extractCapacity(s: Settings) {
  return {
    sedanSeats: String(s.sedanSeats),
    sedanLuggage: String(s.sedanLuggage),
    minivanSeats: String(s.minivanSeats),
    minivanLuggage: String(s.minivanLuggage),
  }
}

function parsePositiveInt(value: string, min: number, max: number, label: string) {
  const n = Number(value)
  if (!Number.isFinite(n) || !Number.isInteger(n)) {
    throw new Error(`${label} must be a whole number.`)
  }
  if (n < min || n > max) {
    throw new Error(`${label} must be between ${min} and ${max}.`)
  }
  return n
}

function VehicleActiveRow({
  title,
  description,
  enabled,
  pending,
  onToggle,
}: {
  title: string
  description: string
  enabled: boolean
  pending: boolean
  onToggle: (next: boolean) => void
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-3">
      <div className="flex min-w-0 flex-col gap-1">
        <span className="text-sm font-medium">{title}</span>
        <span className="text-xs text-muted-foreground">{description}</span>
      </div>
      <div className="flex items-center gap-2.5">
        <span className="text-xs text-muted-foreground">
          {enabled ? "Active" : "Off"}
        </span>
        <Switch
          checked={enabled}
          disabled={pending}
          onCheckedChange={onToggle}
          aria-label={`Toggle ${title}`}
        />
      </div>
    </div>
  )
}

export function RulesPanel({
  settings,
  onSaved,
}: {
  settings: Settings
  onSaved: () => void
}) {
  const [form, setForm] = React.useState(() => extractCapacity(settings))
  const [sedanEnabled, setSedanEnabled] = React.useState(settings.sedanEnabled)
  const [minivanEnabled, setMinivanEnabled] = React.useState(
    settings.minivanEnabled,
  )
  const [pending, setPending] = React.useState(false)
  const [pendingToggle, setPendingToggle] = React.useState<
    "sedanEnabled" | "minivanEnabled" | null
  >(null)

  const serverSnapshot = JSON.stringify(extractCapacity(settings))
  React.useEffect(() => {
    setForm(extractCapacity(settings))
    setSedanEnabled(settings.sedanEnabled)
    setMinivanEnabled(settings.minivanEnabled)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverSnapshot, settings.sedanEnabled, settings.minivanEnabled])

  const dirty = JSON.stringify(form) !== serverSnapshot

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function updateVehicleEnabled(
    key: "sedanEnabled" | "minivanEnabled",
    next: boolean,
    setLocal: (value: boolean) => void,
  ) {
    const previous = key === "sedanEnabled" ? sedanEnabled : minivanEnabled
    if (
      !next &&
      (key === "sedanEnabled" ? !minivanEnabled : !sedanEnabled)
    ) {
      toast.error("At least one vehicle type must stay active.")
      return
    }

    setLocal(next)
    setPendingToggle(key)
    try {
      await apiPatch("/api/admin/settings", { [key]: next })
      toast.success(
        next
          ? `${key === "sedanEnabled" ? "Sedan" : "Minivan"} is now active.`
          : `${key === "sedanEnabled" ? "Sedan" : "Minivan"} is now off.`,
      )
      onSaved()
    } catch (err) {
      setLocal(previous)
      toast.error((err as Error).message)
    } finally {
      setPendingToggle(null)
    }
  }

  async function save() {
    setPending(true)
    try {
      const sedanSeats = parsePositiveInt(form.sedanSeats, 1, 20, "Sedan passengers")
      const sedanLuggage = parsePositiveInt(
        form.sedanLuggage,
        0,
        30,
        "Sedan bags",
      )
      const minivanSeats = parsePositiveInt(
        form.minivanSeats,
        1,
        20,
        "Minivan passengers",
      )
      const minivanLuggage = parsePositiveInt(
        form.minivanLuggage,
        0,
        30,
        "Minivan bags",
      )

      await apiPatch("/api/admin/settings", {
        sedanSeats,
        sedanLuggage,
        minivanSeats,
        minivanLuggage,
      })
      toast.success("Vehicle capacity rules saved.")
      onSaved()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PanelCard
        title="Vehicle availability"
        description="Turn Sedan or Minivan off to hide them from the marketing booking flow. At least one must stay active."
      >
        <div className="flex flex-col gap-3">
          <VehicleActiveRow
            title="Sedan"
            description="Smaller car for short airport runs"
            enabled={sedanEnabled}
            pending={pendingToggle === "sedanEnabled"}
            onToggle={(next) =>
              void updateVehicleEnabled("sedanEnabled", next, setSedanEnabled)
            }
          />
          <VehicleActiveRow
            title="Minivan"
            description="Larger vehicle for families and groups"
            enabled={minivanEnabled}
            pending={pendingToggle === "minivanEnabled"}
            onToggle={(next) =>
              void updateVehicleEnabled(
                "minivanEnabled",
                next,
                setMinivanEnabled,
              )
            }
          />
        </div>
      </PanelCard>

      <PanelCard
        title="Vehicle capacity"
        description="Controls how many people and bags fit Sedan and Minivan when booking auto-selects a vehicle. Enforced on new bookings."
        footer={
          <SaveButton
            dirty={dirty}
            pending={pending}
            onClick={() => void save()}
          />
        }
      >
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="flex flex-col gap-4 rounded-lg border p-4">
            <div>
              <p className="text-sm font-medium">Sedan</p>
              <p className="text-xs text-muted-foreground">
                Smaller car for short airport runs
              </p>
            </div>
            <Field htmlFor="sedanSeats" label="Passengers (max)">
              <Input
                id="sedanSeats"
                type="number"
                inputMode="numeric"
                min={1}
                max={20}
                step={1}
                value={form.sedanSeats}
                onChange={(e) => set("sedanSeats", e.target.value)}
              />
            </Field>
            <Field htmlFor="sedanLuggage" label="Bags (max)">
              <Input
                id="sedanLuggage"
                type="number"
                inputMode="numeric"
                min={0}
                max={30}
                step={1}
                value={form.sedanLuggage}
                onChange={(e) => set("sedanLuggage", e.target.value)}
              />
            </Field>
          </div>

          <div className="flex flex-col gap-4 rounded-lg border p-4">
            <div>
              <p className="text-sm font-medium">Minivan</p>
              <p className="text-xs text-muted-foreground">
                Larger vehicle for families and groups
              </p>
            </div>
            <Field htmlFor="minivanSeats" label="Passengers (max)">
              <Input
                id="minivanSeats"
                type="number"
                inputMode="numeric"
                min={1}
                max={20}
                step={1}
                value={form.minivanSeats}
                onChange={(e) => set("minivanSeats", e.target.value)}
              />
            </Field>
            <Field htmlFor="minivanLuggage" label="Bags (max)">
              <Input
                id="minivanLuggage"
                type="number"
                inputMode="numeric"
                min={0}
                max={30}
                step={1}
                value={form.minivanLuggage}
                onChange={(e) => set("minivanLuggage", e.target.value)}
              />
            </Field>
          </div>
        </div>
      </PanelCard>
    </div>
  )
}
