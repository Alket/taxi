"use client"

import * as React from "react"
import { toast } from "sonner"

import { apiPost, apiPatch } from "@/lib/api"
import type { NotificationChannels, Settings } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { ToneBadge } from "@/components/admin/status-badges"
import { Field, PanelCard, SaveButton } from "@/components/settings/shared"

const CHANNELS: { key: keyof NotificationChannels; label: string; description: string }[] = [
  {
    key: "confirmation",
    label: "Booking confirmation",
    description: "Sent when a booking is confirmed.",
  },
  {
    key: "driverAssigned",
    label: "Driver assigned",
    description: "Sent when a driver is assigned to a trip.",
  },
  {
    key: "flightDelay",
    label: "Flight delay alert",
    description: "Sent when a tracked flight is delayed.",
  },
  {
    key: "reminder",
    label: "Pickup reminder",
    description: "Sent shortly before the scheduled pickup.",
  },
  {
    key: "cancellation",
    label: "Cancellation notice",
    description: "Sent when a booking is cancelled.",
  },
]

export function NotificationsPanel({
  settings,
  onSaved,
}: {
  settings: Settings
  onSaved: () => void
}) {
  const [channels, setChannels] = React.useState<NotificationChannels>(
    settings.notificationChannelsEnabled,
  )
  const [pending, setPending] = React.useState(false)
  const [testing, setTesting] = React.useState(false)

  const serverSnapshot = JSON.stringify(settings.notificationChannelsEnabled)
  React.useEffect(() => {
    setChannels(JSON.parse(serverSnapshot))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverSnapshot])

  const dirty = JSON.stringify(channels) !== serverSnapshot
  const connected = settings.whatsappConnectionStatus === "connected"

  async function save() {
    setPending(true)
    try {
      await apiPatch("/api/admin/settings", {
        notificationChannelsEnabled: channels,
      })
      toast.success("Notification preferences saved.")
      onSaved()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setPending(false)
    }
  }

  async function sendTest() {
    setTesting(true)
    try {
      const res = await apiPost<{ sentTo: string }>(
        "/api/admin/settings/test-whatsapp",
      )
      toast.success(`Test WhatsApp message sent to ${res.sentTo}.`)
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setTesting(false)
    }
  }

  return (
    <PanelCard
      title="Notifications"
      description="Choose which customer messages are sent automatically"
      footer={<SaveButton pending={pending} dirty={dirty} onClick={save} />}
    >
      <Field label="WhatsApp connection">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/30 px-3 py-2.5">
          <div className="flex items-center gap-2.5">
            <ToneBadge tone={connected ? "success" : "destructive"}>
              {connected ? "Connected" : "Disconnected"}
            </ToneBadge>
            <span className="text-sm text-muted-foreground">
              {settings.supportWhatsApp}
            </span>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={sendTest}
            disabled={testing || !connected}
          >
            {testing ? "Sending…" : "Send test message"}
          </Button>
        </div>
      </Field>

      <ul className="flex flex-col divide-y rounded-lg border">
        {CHANNELS.map((c) => (
          <li
            key={c.key}
            className="flex items-center justify-between gap-4 px-3 py-3"
          >
            <div className="flex min-w-0 flex-col">
              <span className="text-sm font-medium">{c.label}</span>
              <span className="text-xs text-muted-foreground">
                {c.description}
              </span>
            </div>
            <Switch
              checked={channels[c.key]}
              onCheckedChange={(v) =>
                setChannels((prev) => ({ ...prev, [c.key]: v }))
              }
              aria-label={`Toggle ${c.label}`}
            />
          </li>
        ))}
      </ul>
    </PanelCard>
  )
}
