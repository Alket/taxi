"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { LockIcon, Plane } from "lucide-react"
import { mutate } from "swr"

import { apiPost } from "@/lib/api"
import { useAdminSession } from "@/hooks/use-admin-session"
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
import { Skeleton } from "@/components/ui/skeleton"

export function SetPasswordForm() {
  const router = useRouter()
  const { user, isLoading } = useAdminSession()
  const [name, setName] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [confirm, setConfirm] = React.useState("")
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!user) return
    setName(user.name.replace(/\s*\(invited\)\s*$/i, "").trim())
  }, [user])

  React.useEffect(() => {
    if (isLoading) return
    if (!user) {
      router.replace("/admin/login")
      return
    }
    if (!user.requiresPasswordReset) {
      router.replace("/admin")
    }
  }, [isLoading, user, router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 8) {
      setError("Password must be at least 8 characters.")
      return
    }
    if (password !== confirm) {
      setError("Passwords do not match.")
      return
    }
    setPending(true)
    setError(null)
    try {
      await apiPost("/api/admin/set-password", {
        password,
        name: name.trim() || undefined,
      })
      await mutate("/api/admin/me")
      toast.success("Password saved. Welcome aboard.")
      router.push("/admin")
      router.refresh()
    } catch (err) {
      const message = (err as Error).message
      setError(message)
      toast.error(message)
    } finally {
      setPending(false)
    }
  }

  if (isLoading || !user?.requiresPasswordReset) {
    return (
      <Card className="w-full max-w-sm">
        <CardContent className="flex flex-col gap-3 py-8">
          <Skeleton className="mx-auto size-11 rounded-xl" />
          <Skeleton className="mx-auto h-5 w-40" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    )
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
        <CardTitle className="text-lg">Set your password</CardTitle>
        <CardDescription>
          Finish setup for {user.email} before using the console.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Display name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              autoComplete="name"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-password">New password</Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="confirm-password">Confirm password</Label>
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Repeat password"
            />
          </div>
          <Button type="submit" className="w-full" disabled={pending}>
            <LockIcon data-icon="inline-start" />
            {pending ? "Saving…" : "Save and continue"}
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
