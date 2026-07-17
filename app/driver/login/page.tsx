"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Loader2Icon } from "lucide-react"

import { apiPost } from "@/lib/api"
import { AdminThemeToggle } from "@/components/admin/theme-toggle"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function DriverLoginPage() {
  const router = useRouter()
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
      setError((err as Error).message || "Login failed.")
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="relative mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-6 px-4 py-10">
      <div className="absolute top-4 right-4">
        <AdminThemeToggle />
      </div>

      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Driver login</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sign in with your phone number and dashboard PIN.
        </p>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="phone">Phone</Label>
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
          <Label htmlFor="pin">PIN</Label>
          <Input
            id="pin"
            type="password"
            inputMode="numeric"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="••••"
            autoComplete="current-password"
            required
            minLength={4}
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
              Signing in…
            </>
          ) : (
            "Sign in"
          )}
        </Button>
      </form>
    </div>
  )
}
