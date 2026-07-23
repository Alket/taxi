"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { LockIcon, Plane } from "lucide-react"

import { apiPost } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { AdminThemeToggle } from "@/components/admin/theme-toggle"

export function LoginForm() {
  const router = useRouter()
  const [email, setEmail] = React.useState("ops@transfers.co")
  const [password, setPassword] = React.useState("")
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || !password.trim()) {
      setError("Enter your email and password.")
      return
    }
    setPending(true)
    setError(null)
    try {
      const result = await apiPost<{
        success: boolean
        requiresPasswordReset?: boolean
      }>("/api/admin/login", { email, password })
      toast.success("Signed in successfully.")
      router.push(
        result.requiresPasswordReset ? "/admin/set-password" : "/admin",
      )
      router.refresh()
    } catch (err) {
      const message = (err as Error).message
      setError(message)
      toast.error(message)
    } finally {
      setPending(false)
    }
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="relative items-center text-center">
        <div className="absolute top-0 right-0">
          <AdminThemeToggle variant="ghost" />
        </div>
        <div className="mx-auto mb-1 flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Plane className="size-5" />
        </div>
        <CardTitle className="text-lg">Transfer Ops</CardTitle>
        <CardDescription>Sign in to the admin console</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@transfers.co"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          <Button type="submit" className="w-full" disabled={pending}>
            <LockIcon data-icon="inline-start" />
            {pending ? "Signing in…" : "Sign in"}
          </Button>
          {error ? (
            <p className="text-center text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </form>
      </CardContent>
    </Card>
  )
}
