"use client"

import * as React from "react"
import { toast } from "sonner"

import { apiPost, apiPatch } from "@/lib/api"
import type { NotificationChannels, Settings } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { ToneBadge } from "@/components/admin/status-badges"
import { Field, PanelCard, SaveButton } from "@/components/settings/shared"

const CHANNELS: {
  key: keyof NotificationChannels
  label: string
  description: string
}[] = [
  {
    key: "confirmation",
    label: "Booking confirmation",
    description: "Customer email when a booking is confirmed.",
  },
  {
    key: "cancellation",
    label: "Cancellation notice",
    description: "Customer email when a booking is cancelled.",
  },
  {
    key: "dateChange",
    label: "Date / time change",
    description: "Customer email when pickup date or time is changed.",
  },
  {
    key: "driverAssigned",
    label: "Driver accepted",
    description: "Customer email with driver name and contact after the driver accepts the trip.",
  },
  {
    key: "reminder",
    label: "Pickup reminder",
    description: "Customer email about 24 hours before pickup.",
  },
  {
    key: "completedReceipt",
    label: "Completed trip receipt",
    description: "Customer email when the trip is marked completed.",
  },
  {
    key: "reviewRequest",
    label: "Post-trip review request",
    description:
      "Customer email after a completed trip asking for driver and platform ratings.",
  },
  {
    key: "flightDelay",
    label: "Flight delay alert",
    description: "Customer email when a tracked flight is delayed.",
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
  const [adminEmail, setAdminEmail] = React.useState(
    settings.adminNotificationEmail || "",
  )
  const [pending, setPending] = React.useState(false)
  const [testing, setTesting] = React.useState(false)

  const serverSnapshot = JSON.stringify({
    channels: settings.notificationChannelsEnabled,
    adminEmail: settings.adminNotificationEmail || "",
  })
  React.useEffect(() => {
    const parsed = JSON.parse(serverSnapshot) as {
      channels: NotificationChannels
      adminEmail: string
    }
    setChannels(parsed.channels)
    setAdminEmail(parsed.adminEmail)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverSnapshot])

  const dirty =
    JSON.stringify({ channels, adminEmail: adminEmail.trim() }) !==
    serverSnapshot
  const connected = settings.whatsappConnectionStatus === "connected"

  async function save() {
    setPending(true)
    try {
      await apiPatch("/api/admin/settings", {
        notificationChannelsEnabled: channels,
        adminNotificationEmail: adminEmail.trim(),
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
      description="Customer email toggles and the ops inbox for admin alerts"
      footer={<SaveButton pending={pending} dirty={dirty} onClick={save} />}
    >
      <Field
        label="Admin notification email"
        hint="Receives new booking, cancellation, and date-change alerts. Leave blank to use support email."
      >
        <Input
          type="email"
          value={adminEmail}
          onChange={(e) => setAdminEmail(e.target.value)}
          placeholder={settings.supportEmail || "ops@example.com"}
        />
      </Field>

      <p className="text-xs text-muted-foreground">
        Admin alerts for new bookings, cancellations, and date changes are always
        emailed to the address above when SMTP is configured. Switches below
        control customer emails only.
      </p>

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
