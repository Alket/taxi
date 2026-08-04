"use client"

import * as React from "react"
import { toast } from "sonner"
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  MailIcon,
} from "lucide-react"

import { apiPatch, apiPost } from "@/lib/api"
import type { Settings } from "@/lib/types"
import { ToneBadge } from "@/components/admin/status-badges"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Field, PanelCard, SaveButton } from "@/components/settings/shared"

type FormState = {
  smtpHost: string
  smtpPort: string
  smtpSecure: boolean
  smtpUser: string
  smtpFrom: string
  smtpTlsRejectUnauthorized: boolean
  smtpPass: string
}

function extract(settings: Settings): Omit<FormState, "smtpPass"> {
  return {
    smtpHost: settings.smtpHost || "",
    smtpPort: String(settings.smtpPort || 465),
    smtpSecure: settings.smtpSecure,
    smtpUser: settings.smtpUser || "",
    smtpFrom: settings.smtpFrom || "",
    smtpTlsRejectUnauthorized: settings.smtpTlsRejectUnauthorized,
  }
}

export function SmtpPanel({
  settings,
  onSaved,
}: {
  settings: Settings
  onSaved: () => void
}) {
  const [form, setForm] = React.useState<FormState>(() => ({
    ...extract(settings),
    smtpPass: "",
  }))
  const [pending, setPending] = React.useState(false)
  const [testing, setTesting] = React.useState(false)
  const [testTo, setTestTo] = React.useState(
    () => settings.adminNotificationEmail || settings.supportEmail || "",
  )

  const serverSnapshot = JSON.stringify(extract(settings))
  React.useEffect(() => {
    setForm((prev) => ({ ...extract(settings), smtpPass: prev.smtpPass }))
    setTestTo(
      settings.adminNotificationEmail || settings.supportEmail || "",
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverSnapshot])

  const dirty =
    form.smtpHost.trim() !== (settings.smtpHost || "") ||
    form.smtpPort !== String(settings.smtpPort || 465) ||
    form.smtpSecure !== settings.smtpSecure ||
    form.smtpUser.trim() !== (settings.smtpUser || "") ||
    form.smtpFrom.trim() !== (settings.smtpFrom || "") ||
    form.smtpTlsRejectUnauthorized !== settings.smtpTlsRejectUnauthorized ||
    Boolean(form.smtpPass.trim())

  const configured =
    Boolean(settings.smtpHost?.trim()) &&
    Boolean(settings.smtpUser?.trim()) &&
    settings.smtpPassSet

  function patch<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function save() {
    setPending(true)
    try {
      const port = Number(form.smtpPort)
      const payload: Record<string, unknown> = {
        smtpHost: form.smtpHost.trim(),
        smtpPort: Number.isFinite(port) ? port : 465,
        smtpSecure: form.smtpSecure,
        smtpUser: form.smtpUser.trim(),
        smtpFrom: form.smtpFrom.trim(),
        smtpTlsRejectUnauthorized: form.smtpTlsRejectUnauthorized,
      }
      if (form.smtpPass.trim()) {
        payload.smtpPass = form.smtpPass.trim()
      }
      await apiPatch("/api/admin/settings", payload)
      setForm((prev) => ({ ...prev, smtpPass: "" }))
      toast.success("SMTP settings saved.")
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
        "/api/admin/settings/test-smtp",
        { to: testTo.trim() || undefined },
      )
      toast.success(`Test email sent to ${res.sentTo}.`)
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setTesting(false)
    }
  }

  return (
    <PanelCard
      title="SMTP"
      description="Outbound email for booking confirmations, reminders, and team invites"
      footer={<SaveButton pending={pending} dirty={dirty} onClick={() => void save()} />}
    >
      <div className="flex flex-wrap items-center gap-2">
        <ToneBadge tone={configured ? "success" : "neutral"} dot={configured}>
          {configured ? "Configured" : "Not configured"}
        </ToneBadge>
        {!configured && (
          <span className="text-xs text-muted-foreground">
            Falls back to SMTP_* environment variables when the form is empty.
          </span>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Host"
          htmlFor="smtpHost"
          hint="Public FQDN only (e.g. smtp.gmail.com). Private/local hosts are blocked."
        >
          <Input
            id="smtpHost"
            value={form.smtpHost}
            onChange={(e) => patch("smtpHost", e.target.value)}
            placeholder="smtp.example.com"
            autoComplete="off"
          />
        </Field>
        <Field
          label="Port"
          htmlFor="smtpPort"
          hint="Allowed: 25, 465, 587, 2465, 2525, 2587"
        >
          <Input
            id="smtpPort"
            type="number"
            min={1}
            max={65535}
            value={form.smtpPort}
            onChange={(e) => patch("smtpPort", e.target.value)}
          />
        </Field>
        <Field label="Username" htmlFor="smtpUser">
          <Input
            id="smtpUser"
            value={form.smtpUser}
            onChange={(e) => patch("smtpUser", e.target.value)}
            placeholder="noreply@example.com"
            autoComplete="off"
          />
        </Field>
        <Field
          label="Password"
          htmlFor="smtpPass"
          hint={
            settings.smtpPassSet
              ? "Encrypted at rest. Leave blank to keep the saved password."
              : "Stored encrypted. Use an app password when available."
          }
        >
          <Input
            id="smtpPass"
            type="password"
            value={form.smtpPass}
            onChange={(e) => patch("smtpPass", e.target.value)}
            placeholder={settings.smtpPassSet ? "•••••••• (saved)" : "Enter password"}
            autoComplete="new-password"
          />
        </Field>
        <div className="sm:col-span-2">
          <Field
            label="From address"
            htmlFor="smtpFrom"
            hint='Optional. e.g. "Albania Transfers <noreply@example.com>". Defaults to username.'
          >
            <Input
              id="smtpFrom"
              value={form.smtpFrom}
              onChange={(e) => patch("smtpFrom", e.target.value)}
              placeholder="Albania Transfers <noreply@example.com>"
              autoComplete="off"
            />
          </Field>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-3">
          <div className="min-w-0">
            <p className="text-sm font-medium">Use SSL / TLS (secure)</p>
            <p className="text-xs text-muted-foreground">
              On for port 465. Usually off for port 587 with STARTTLS.
            </p>
          </div>
          <Switch
            checked={form.smtpSecure}
            onCheckedChange={(next) => patch("smtpSecure", next)}
            aria-label="Toggle SMTP secure"
          />
        </div>
        <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-3">
          <div className="min-w-0">
            <p className="text-sm font-medium">Verify TLS certificate</p>
            <p className="text-xs text-muted-foreground">
              Keep on unless your provider uses a mismatched certificate.
            </p>
          </div>
          <Switch
            checked={form.smtpTlsRejectUnauthorized}
            onCheckedChange={(next) =>
              patch("smtpTlsRejectUnauthorized", next)
            }
            aria-label="Toggle TLS certificate verification"
          />
        </div>
        {!form.smtpTlsRejectUnauthorized ? (
          <div className="flex items-start gap-2.5 rounded-lg border border-warning/40 bg-warning/12 px-3 py-2.5 text-warning">
            <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" />
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">
                TLS certificate verification is off
              </span>
              <span className="text-xs">
                Your SMTP username and password can be intercepted on the
                network (MITM). Only disable this for broken shared-host
                certificates.
              </span>
            </div>
          </div>
        ) : null}
      </div>

      <div className="rounded-lg border bg-muted/20 p-4">
        <div className="mb-3 flex items-center gap-2">
          <MailIcon className="size-4 text-muted-foreground" />
          <p className="text-sm font-medium">Send test email</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <Field
            label="Recipient"
            htmlFor="smtpTestTo"
            hint="Only your admin, support, or notification email. Max 3 tests / 10 min."
          >
            <Input
              id="smtpTestTo"
              type="email"
              value={testTo}
              onChange={(e) => setTestTo(e.target.value)}
              placeholder="you@example.com"
            />
          </Field>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0"
            disabled={testing}
            onClick={() => void sendTest()}
          >
            {testing ? "Sending…" : "Send test"}
          </Button>
        </div>
        {configured && (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
            <CheckCircle2Icon className="size-3.5 text-emerald-600" />
            Save changes before testing if you edited the form.
          </p>
        )}
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          A test to <span className="font-medium text-foreground">support@…</span>{" "}
          only proves your mailbox accepts mail on the same server. Also send a
          test to your personal Gmail/admin address. If that never arrives,
          fix SPF/DKIM/DMARC on your domain (Namecheap / Cloudflare DNS) so
          Gmail trusts <span className="font-medium text-foreground">no-reply@…</span>.
        </p>
      </div>
    </PanelCard>
  )
}
