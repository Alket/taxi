"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  AlertCircleIcon,
  ArrowLeftIcon,
  EyeIcon,
  EyeOffIcon,
  Loader2Icon,
  LockIcon,
} from "lucide-react"

import { AdminThemeToggle } from "@/components/admin/theme-toggle"
import { DriverLanguageSwitcher } from "@/components/driver/driver-language-switcher"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { apiPost } from "@/lib/api"
import { useDriverT } from "@/lib/i18n/driver"

export function DriverLoginView() {
  const router = useRouter()
  const t = useDriverT()
  const [phone, setPhone] = React.useState("")
  const [pin, setPin] = React.useState("")
  const [showPin, setShowPin] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [pending, setPending] = React.useState(false)
  const phoneRef = React.useRef<HTMLInputElement>(null)
  const pinRef = React.useRef<HTMLInputElement>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmedPhone = phone.trim()
    if (!trimmedPhone) {
      setError(t("login.phoneRequired"))
      phoneRef.current?.focus()
      return
    }
    if (!pin) {
      setError(t("login.pinRequired"))
      pinRef.current?.focus()
      return
    }
    if (pin.length < 4) {
      setError(t("login.pinTooShort"))
      pinRef.current?.focus()
      return
    }

    setPending(true)
    setError(null)
    try {
      await apiPost("/api/driver/login", { phone: trimmedPhone, pin })
      toast.success(t("login.success"))
      router.push("/driver")
      router.refresh()
    } catch (err) {
      const message =
        err instanceof Error && err.message ? err.message : t("login.failed")
      setError(message)
      pinRef.current?.focus()
    } finally {
      setPending(false)
    }
  }

  return (
    <main className="relative flex min-h-svh flex-col items-center justify-center bg-background px-4 py-12">
      <div className="absolute top-4 right-4 flex items-center gap-2 sm:top-6 sm:right-6">
        <DriverLanguageSwitcher size="sm" />
        <AdminThemeToggle
          variant="ghost"
          labels={{
            light: t("theme.light"),
            dark: t("theme.dark"),
            toLight: t("theme.toLight"),
            toDark: t("theme.toDark"),
          }}
        />
      </div>

      <div className="w-full max-w-[24.5rem]">
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
              {t("login.title")}
            </h1>
            <CardDescription className="text-sm text-muted-foreground">
              {t("login.subtitle")}
            </CardDescription>
          </CardHeader>

          <CardContent className="px-6 pt-4 pb-7 sm:px-7">
            <form
              onSubmit={onSubmit}
              className="flex flex-col gap-4"
              noValidate
            >
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="driver-phone" className="text-sm font-medium">
                  {t("login.phone")}
                </Label>
                <Input
                  ref={phoneRef}
                  id="driver-phone"
                  name="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  required
                  disabled={pending}
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? "driver-login-error" : undefined}
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value)
                    if (error) setError(null)
                  }}
                  placeholder="+355 68 000 0000"
                  className="h-10"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="driver-pin" className="text-sm font-medium">
                  {t("login.pin")}
                </Label>
                <div className="relative">
                  <Input
                    ref={pinRef}
                    id="driver-pin"
                    name="pin"
                    type={showPin ? "text" : "password"}
                    autoComplete="current-password"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    required
                    minLength={4}
                    maxLength={12}
                    disabled={pending}
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? "driver-login-error" : undefined}
                    value={pin}
                    onChange={(e) => {
                      setPin(e.target.value)
                      if (error) setError(null)
                    }}
                    placeholder={t("login.pinPlaceholder")}
                    className="h-10 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPin((prev) => !prev)}
                    disabled={pending}
                    aria-label={showPin ? t("login.hidePin") : t("login.showPin")}
                    aria-pressed={showPin}
                    className="absolute top-1/2 right-1.5 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
                  >
                    {showPin ? (
                      <EyeOffIcon className="size-4" aria-hidden />
                    ) : (
                      <EyeIcon className="size-4" aria-hidden />
                    )}
                  </button>
                </div>
              </div>

              {error ? (
                <div
                  id="driver-login-error"
                  role="alert"
                  className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/8 px-3 py-2.5 text-sm text-destructive"
                >
                  <AlertCircleIcon
                    className="mt-0.5 size-4 shrink-0"
                    aria-hidden
                  />
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
                    <span>{t("login.signingIn")}</span>
                  </>
                ) : (
                  <>
                    <LockIcon
                      className="size-4"
                      data-icon="inline-start"
                      aria-hidden
                    />
                    <span>{t("login.submit")}</span>
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="mt-6 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <ArrowLeftIcon className="size-3.5" aria-hidden />
            <span>{t("login.backToWebsite")}</span>
          </Link>
        </div>
      </div>
    </main>
  )
}

