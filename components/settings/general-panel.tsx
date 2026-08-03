"use client"

import * as React from "react"
import { toast } from "sonner"
import { CheckIcon, ImagePlusIcon, Loader2Icon, Trash2Icon } from "lucide-react"

import { apiPatch } from "@/lib/api"
import { cn } from "@/lib/utils"
import type { DisplayCurrency, Settings } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Field, PanelCard, SaveButton } from "@/components/settings/shared"

const CURRENCIES: DisplayCurrency[] = ["EUR", "USD", "GBP"]
const DEFAULT_FAVICON = "/marketing/favicon.png"

function extract(s: Settings) {
  return {
    companyName: s.companyName,
    supportPhone: s.supportPhone,
    supportEmail: s.supportEmail,
    supportWhatsApp: s.supportWhatsApp,
    faviconUrl: s.faviconUrl ?? "",
    searchIndexingEnabled: s.searchIndexingEnabled === true,
    displayCurrencies: s.displayCurrencies,
    depositPercentage: String(s.depositPercentage),
    infantCarrierPrice: String(s.infantCarrierPrice),
    childSeatPrice: String(s.childSeatPrice),
    boosterSeatPrice: String(s.boosterSeatPrice),
  }
}

export function GeneralPanel({
  settings,
  onSaved,
}: {
  settings: Settings
  onSaved: () => void
}) {
  const [form, setForm] = React.useState(() => extract(settings))
  const [pending, setPending] = React.useState(false)
  const [uploading, setUploading] = React.useState(false)
  const fileRef = React.useRef<HTMLInputElement>(null)

  const serverSnapshot = JSON.stringify(extract(settings))
  React.useEffect(() => {
    setForm(extract(settings))
    // Re-seed only when the persisted values change (e.g. after a save).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverSnapshot])

  const dirty = JSON.stringify(form) !== serverSnapshot
  const previewSrc = form.faviconUrl.trim() || DEFAULT_FAVICON

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function toggleCurrency(c: DisplayCurrency) {
    setForm((f) => {
      const has = f.displayCurrencies.includes(c)
      const next = has
        ? f.displayCurrencies.filter((x) => x !== c)
        : [...f.displayCurrencies, c]
      // Preserve canonical order for stable dirty comparison.
      return { ...f, displayCurrencies: CURRENCIES.filter((x) => next.includes(x)) }
    })
  }

  async function uploadFavicon(file: File) {
    setUploading(true)
    try {
      const body = new FormData()
      body.set("file", file)
      body.set("title", "Site favicon")
      body.set("alt", "Site favicon")
      const res = await fetch("/api/admin/uploads", {
        method: "POST",
        body,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || "Upload failed.")
      }
      if (typeof data.url !== "string" || !data.url) {
        throw new Error("Upload did not return a URL.")
      }
      set("faviconUrl", data.url)
      toast.success("Favicon uploaded. Save changes to apply.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed.")
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  async function save() {
    if (!form.companyName.trim()) {
      toast.error("Company name is required.")
      return
    }
    if (form.displayCurrencies.length === 0) {
      toast.error("Select at least one display currency.")
      return
    }
    setPending(true)
    try {
      await apiPatch("/api/admin/settings", {
        companyName: form.companyName.trim(),
        supportPhone: form.supportPhone.trim(),
        supportEmail: form.supportEmail.trim(),
        supportWhatsApp: form.supportWhatsApp.trim(),
        faviconUrl: form.faviconUrl.trim(),
        searchIndexingEnabled: form.searchIndexingEnabled,
        displayCurrencies: form.displayCurrencies,
        depositPercentage: Number(form.depositPercentage),
        infantCarrierPrice: Number(form.infantCarrierPrice),
        childSeatPrice: Number(form.childSeatPrice),
        boosterSeatPrice: Number(form.boosterSeatPrice),
      })
      toast.success("General settings saved.")
      onSaved()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setPending(false)
    }
  }

  return (
    <PanelCard
      title="General"
      description="Company details, support contacts, and booking policy"
      footer={<SaveButton pending={pending} dirty={dirty} onClick={save} />}
    >
      <Field label="Company name" htmlFor="companyName">
        <Input
          id="companyName"
          value={form.companyName}
          onChange={(e) => set("companyName", e.target.value)}
          placeholder="Transfer Ops"
        />
      </Field>

      <Field
        label="Site favicon"
        hint="PNG, WebP, JPEG, GIF, or SVG. Shown in browser tabs and bookmarks."
      >
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex size-14 items-center justify-center overflow-hidden rounded-xl border border-border bg-muted/40">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewSrc}
              alt="Favicon preview"
              className="size-10 object-contain"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void uploadFavicon(file)
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
            >
              {uploading ? (
                <Loader2Icon className="size-3.5 animate-spin" />
              ) : (
                <ImagePlusIcon className="size-3.5" />
              )}
              {uploading ? "Uploading…" : "Upload favicon"}
            </Button>
            {form.faviconUrl ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={uploading}
                onClick={() => set("faviconUrl", "")}
              >
                <Trash2Icon className="size-3.5" />
                Use default
              </Button>
            ) : null}
          </div>
        </div>
      </Field>

      <Field
        label="Search engines"
        hint={
          form.searchIndexingEnabled
            ? "Indexing is allowed. Google/Bing may list public pages. Admin and API stay blocked in robots.txt."
            : "Indexing is blocked (recommended until launch). Pages send noindex and robots.txt disallows all crawlers."
        }
      >
        <label className="flex items-center gap-3 rounded-xl border border-border bg-muted/20 px-3.5 py-3">
          <Switch
            checked={form.searchIndexingEnabled}
            onCheckedChange={(checked) =>
              set("searchIndexingEnabled", Boolean(checked))
            }
          />
          <span className="text-sm font-medium">
            Allow search engines to index this site
          </span>
        </label>
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Support phone" htmlFor="supportPhone">
          <Input
            id="supportPhone"
            value={form.supportPhone}
            onChange={(e) => set("supportPhone", e.target.value)}
            placeholder="+39 02 8901 2345"
          />
        </Field>
        <Field label="Support email" htmlFor="supportEmail">
          <Input
            id="supportEmail"
            type="email"
            value={form.supportEmail}
            onChange={(e) => set("supportEmail", e.target.value)}
            placeholder="ops@transfers.co"
          />
        </Field>
      </div>

      <Field label="Support WhatsApp" htmlFor="supportWhatsApp">
        <Input
          id="supportWhatsApp"
          value={form.supportWhatsApp}
          onChange={(e) => set("supportWhatsApp", e.target.value)}
          placeholder="+39 320 000 1122"
        />
      </Field>

      <Field
        label="Display currencies"
        hint="Currencies customers can see prices in."
      >
        <div className="flex flex-wrap gap-2">
          {CURRENCIES.map((c) => {
            const active = form.displayCurrencies.includes(c)
            return (
              <button
                key={c}
                type="button"
                onClick={() => toggleCurrency(c)}
                aria-pressed={active}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
                  active
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-input text-muted-foreground hover:bg-accent",
                )}
              >
                {active && <CheckIcon className="size-3.5" />}
                {c}
              </button>
            )
          })}
        </div>
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Deposit percentage"
          htmlFor="depositPercentage"
          hint="Share of the total charged upfront (0–100). Cancelling forfeits this deposit — no refund."
        >
          <Input
            id="depositPercentage"
            type="number"
            min={0}
            max={100}
            value={form.depositPercentage}
            onChange={(e) => set("depositPercentage", e.target.value)}
          />
        </Field>
      </div>

      <div className="rounded-xl border bg-muted/30 p-4">
        <div className="mb-3">
          <p className="text-sm font-semibold">Child seat prices</p>
          <p className="text-xs text-muted-foreground">
            Per-seat add-on charged on the public booking form (first display
            currency).
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field
            label="Infant carrier"
            htmlFor="infantCarrierPrice"
            hint="0–6 months"
          >
            <Input
              id="infantCarrierPrice"
              type="number"
              min={0}
              max={500}
              step="0.01"
              value={form.infantCarrierPrice}
              onChange={(e) => set("infantCarrierPrice", e.target.value)}
            />
          </Field>
          <Field
            label="Child seat"
            htmlFor="childSeatPrice"
            hint="6 months – 3 years"
          >
            <Input
              id="childSeatPrice"
              type="number"
              min={0}
              max={500}
              step="0.01"
              value={form.childSeatPrice}
              onChange={(e) => set("childSeatPrice", e.target.value)}
            />
          </Field>
          <Field label="Booster" htmlFor="boosterSeatPrice" hint="3–12 years">
            <Input
              id="boosterSeatPrice"
              type="number"
              min={0}
              max={500}
              step="0.01"
              value={form.boosterSeatPrice}
              onChange={(e) => set("boosterSeatPrice", e.target.value)}
            />
          </Field>
        </div>
      </div>
    </PanelCard>
  )
}
