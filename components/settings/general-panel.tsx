"use client"

import * as React from "react"
import { toast } from "sonner"
import { CheckIcon } from "lucide-react"

import { apiPatch } from "@/lib/api"
import { cn } from "@/lib/utils"
import type { DisplayCurrency, Settings } from "@/lib/types"
import { Input } from "@/components/ui/input"
import { Field, PanelCard, SaveButton } from "@/components/settings/shared"

const CURRENCIES: DisplayCurrency[] = ["EUR", "USD", "GBP"]

function extract(s: Settings) {
  return {
    companyName: s.companyName,
    supportPhone: s.supportPhone,
    supportEmail: s.supportEmail,
    supportWhatsApp: s.supportWhatsApp,
    displayCurrencies: s.displayCurrencies,
    freeCancellationHours: String(s.freeCancellationHours),
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

  const serverSnapshot = JSON.stringify(extract(settings))
  React.useEffect(() => {
    setForm(extract(settings))
    // Re-seed only when the persisted values change (e.g. after a save).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverSnapshot])

  const dirty = JSON.stringify(form) !== serverSnapshot

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
        displayCurrencies: form.displayCurrencies,
        freeCancellationHours: Number(form.freeCancellationHours),
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
          label="Free cancellation window (hours)"
          htmlFor="freeCancellationHours"
          hint="Hours before pickup a customer can cancel for free."
        >
          <Input
            id="freeCancellationHours"
            type="number"
            min={0}
            max={336}
            value={form.freeCancellationHours}
            onChange={(e) => set("freeCancellationHours", e.target.value)}
          />
        </Field>
        <Field
          label="Deposit percentage"
          htmlFor="depositPercentage"
          hint="Share of the total charged upfront (0–100)."
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
