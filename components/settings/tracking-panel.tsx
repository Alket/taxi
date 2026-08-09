"use client"

import * as React from "react"
import { toast } from "sonner"
import { CheckCircle2Icon } from "lucide-react"

import { apiPatch } from "@/lib/api"
import type { Settings } from "@/lib/types"
import { Input } from "@/components/ui/input"
import { Field, PanelCard, SaveButton } from "@/components/settings/shared"

function normalizeGtmId(value: string) {
  return value.trim().toUpperCase()
}

function isValidGtmId(value: string) {
  if (!value) return true
  return /^GTM-[A-Z0-9]+$/.test(value)
}

export function TrackingPanel({
  settings,
  onSaved,
}: {
  settings: Settings
  onSaved: () => void
}) {
  const [gtmContainerId, setGtmContainerId] = React.useState(
    () => settings.gtmContainerId ?? "",
  )
  const [pending, setPending] = React.useState(false)

  React.useEffect(() => {
    setGtmContainerId(settings.gtmContainerId ?? "")
  }, [settings.gtmContainerId])

  const dirty =
    normalizeGtmId(gtmContainerId) !==
    normalizeGtmId(settings.gtmContainerId ?? "")
  const active = Boolean(normalizeGtmId(settings.gtmContainerId ?? ""))

  async function save() {
    const next = normalizeGtmId(gtmContainerId)
    if (!isValidGtmId(next)) {
      toast.error("Use a container ID like GTM-NJCSBVHL.")
      return
    }
    setPending(true)
    try {
      await apiPatch("/api/admin/settings", { gtmContainerId: next })
      toast.success("Tracking settings saved.")
      onSaved()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setPending(false)
    }
  }

  return (
    <PanelCard
      title="Tracking"
      description="Install analytics and marketing tags on the public website"
      footer={<SaveButton pending={pending} dirty={dirty} onClick={save} />}
    >
      <Field
        label="Google Tag Manager container ID"
        htmlFor="gtmContainerId"
        hint="Paste only the ID from Google (e.g. GTM-NJCSBVHL). Leave empty to disable. The GTM script loads on public pages with Google Consent Mode (storage denied until Analytics or Marketing cookies are accepted). Never on /admin or /driver."
      >
        <Input
          id="gtmContainerId"
          value={gtmContainerId}
          onChange={(e) => setGtmContainerId(e.target.value)}
          placeholder="GTM-XXXXXXX"
          autoComplete="off"
          spellCheck={false}
          className="max-w-xs font-mono uppercase"
        />
      </Field>

      {active ? (
        <p className="flex items-start gap-2 rounded-lg border border-emerald-500/25 bg-emerald-500/5 px-3 py-2.5 text-xs text-muted-foreground">
          <CheckCircle2Icon className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />
          <span>
            GTM is active with{" "}
            <span className="font-mono font-semibold text-foreground">
              {settings.gtmContainerId}
            </span>
            . Public pages load the tag with Consent Mode; Analytics/Marketing
            storage stays denied until the visitor accepts those cookies. Blocked
            on /admin and /driver.
          </span>
        </p>
      ) : (
        <p className="rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-xs text-muted-foreground">
          No container configured — Google Tag Manager is not installed.
        </p>
      )}
    </PanelCard>
  )
}
