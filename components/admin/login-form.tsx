"use client"

import * as React from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  AlertCircleIcon,
  EyeIcon,
  EyeOffIcon,
  Loader2Icon,
  LockIcon,
} from "lucide-react"

import { apiPost } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card"

export function LoginForm() {
  const router = useRouter()
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [showPassword, setShowPassword] = React.useState(false)
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const emailRef = React.useRef<HTMLInputElement>(null)
  const passwordRef = React.useRef<HTMLInputElement>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmedEmail = email.trim()
    if (!trimmedEmail) {
      setError("Enter your email address.")
      emailRef.current?.focus()
      return
    }
    if (!password) {
      setError("Enter your password.")
      passwordRef.current?.focus()
      return
    }

    setPending(true)
    setError(null)
    try {
      const result = await apiPost<{
        success: boolean
        requiresPasswordReset?: boolean
      }>("/api/admin/login", { email: trimmedEmail, password })
      toast.success("Signed in successfully.")
      router.push(
        result.requiresPasswordReset ? "/admin/set-password" : "/admin",
      )
      router.refresh()
    } catch (err) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : "Invalid email or password. Try again."
      setError(message)
      passwordRef.current?.focus()
    } finally {
      setPending(false)
    }
  }

  return (
    <Card className="w-full border-border/80 shadow-[0_8px_30px_-12px_rgba(15,23,42,0.12)] dark:shadow-[0_12px_36px_-12px_rgba(0,0,0,0.45)]">
      <CardHeader className="items-center space-y-2 pb-2 pt-7 text-center">
        <div className="mb-1 flex h-11 items-center justify-center">
          <Image
            src="/marketing/logo.svg"
            alt="Landed Albania"
            width={138}
            height={100}
            className="h-9 w-auto dark:brightness-0 dark:invert"
            priority
          />
        </div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Operations Console
        </h1>
        <CardDescription className="text-sm text-muted-foreground">
          Sign in with your staff account to manage bookings and dispatch.
        </CardDescription>
      </CardHeader>

      <CardContent className="px-6 pt-4 pb-7 sm:px-7">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="admin-email" className="text-sm font-medium">
              Email
            </Label>
            <Input
              ref={emailRef}
              id="admin-email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              required
              disabled={pending}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "admin-login-error" : undefined}
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                if (error) setError(null)
              }}
              placeholder="name@landedalbania.com"
              className="h-10"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="admin-password" className="text-sm font-medium">
              Password
            </Label>
            <div className="relative">
              <Input
                ref={passwordRef}
                id="admin-password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                disabled={pending}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? "admin-login-error" : undefined}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  if (error) setError(null)
                }}
                placeholder="Enter your password"
                className="h-10 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                disabled={pending}
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
                className="absolute top-1/2 right-1.5 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
              >
                {showPassword ? (
                  <EyeOffIcon className="size-4" aria-hidden />
                ) : (
                  <EyeIcon className="size-4" aria-hidden />
                )}
              </button>
            </div>
          </div>

          {error ? (
            <div
              id="admin-login-error"
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/8 px-3 py-2.5 text-sm text-destructive"
            >
              <AlertCircleIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>{error}</span>
            </div>
          ) : null}

          <Button
            type="submit"
            size="lg"
            className="mt-1 h-10 w-full font-medium"
            disabled={pending}
          >
            {pending ? (
              <>
                <Loader2Icon
                  className="size-4 animate-spin"
                  data-icon="inline-start"
                  aria-hidden
                />
                <span>Signing in…</span>
              </>
            ) : (
              <>
                <LockIcon
                  className="size-4"
                  data-icon="inline-start"
                  aria-hidden
                />
                <span>Sign in</span>
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
