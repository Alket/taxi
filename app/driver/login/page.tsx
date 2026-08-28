"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Loader2Icon } from "lucide-react"

import { apiPost } from "@/lib/api"
import { AdminThemeToggle } from "@/components/admin/theme-toggle"
import { DriverLanguageSwitcher } from "@/components/driver/driver-language-switcher"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useDriverT } from "@/lib/i18n/driver"

export default function DriverLoginPage() {
  const router = useRouter()
  const t = useDriverT()
  const [phone, setPhone] = React.useState("")
  const [pin, setPin] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [pending, setPending] = React.useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setPending(true)
    setError(null)
    try {
      await apiPost("/api/driver/login", { phone, pin })
      router.push("/driver")
      router.refresh()
    } catch (err) {
      setError((err as Error).message || t("login.failed"))
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="relative mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-6 px-4 py-10">
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <DriverLanguageSwitcher size="sm" />
        <AdminThemeToggle
          labels={{
            light: t("theme.light"),
            dark: t("theme.dark"),
            toLight: t("theme.toLight"),
            toDark: t("theme.toDark"),
          }}
        />
      </div>

      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight">{t("login.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("login.subtitle")}</p>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="phone">{t("login.phone")}</Label>
          <Input
            id="phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+355…"
            autoComplete="tel"
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="pin">{t("login.pin")}</Label>
          <Input
            id="pin"
            type="password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="Letters & numbers"
            autoComplete="current-password"
            required
            minLength={4}
            maxLength={12}
            spellCheck={false}
          />
        </div>

        {error && (
          <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending ? (
            <>
              <Loader2Icon className="animate-spin" data-icon="inline-start" />
              {t("login.signingIn")}
            </>
          ) : (
            t("login.submit")
          )}
        </Button>
      </form>
    </div>
  )
}
