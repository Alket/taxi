"use client"

import * as React from "react"
import { BellIcon, BellOffIcon, BellRingIcon } from "lucide-react"
import { toast } from "sonner"

import { apiDelete, apiPost, fetcher } from "@/lib/api"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

type Audience = "admin" | "driver"

type AlertBooking = {
  id: string
  referenceCode: string
  pickupAddress: string
  dropoffAddress: string
  customerName?: string
  pickupLabel?: string
}

function urlBase64ToUint8Array(base64String: string) {
  const cleaned = base64String.trim().replace(/^["']|["']$/g, "")
  const padding = "=".repeat((4 - (cleaned.length % 4)) % 4)
  const base64 = (cleaned + padding).replace(/-/g, "+").replace(/_/g, "/")
  const raw = atob(base64)
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i)
  return output
}

function arrayBufferToBase64Url(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer)
  let binary = ""
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]!)
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

function readSubscriptionKeys(subscription: PushSubscription) {
  const json = subscription.toJSON()
  if (json.keys?.p256dh && json.keys?.auth) {
    return { p256dh: json.keys.p256dh, auth: json.keys.auth }
  }

  // iOS Safari sometimes omits keys from toJSON(); read ArrayBuffers instead.
  const p256dh = subscription.getKey("p256dh")
  const auth = subscription.getKey("auth")
  if (!p256dh || !auth) return null

  return {
    p256dh: arrayBufferToBase64Url(p256dh),
    auth: arrayBufferToBase64Url(auth),
  }
}

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return null

  const registration = await navigator.serviceWorker.register("/sw.js", {
    scope: "/",
    updateViaCache: "none",
  })

  // Ensure the worker is active before PushManager.subscribe (required on iOS).
  if (registration.installing) {
    await new Promise<void>((resolve, reject) => {
      const worker = registration.installing
      if (!worker) {
        resolve()
        return
      }
      worker.addEventListener("statechange", () => {
        if (worker.state === "activated") resolve()
        if (worker.state === "redundant") {
          reject(new Error("Service worker failed to activate."))
        }
      })
    })
  }

  await navigator.serviceWorker.ready
  return registration
}

function subscribePath(audience: Audience) {
  return audience === "admin"
    ? "/api/admin/push/subscribe"
    : "/api/driver/push/subscribe"
}

async function createPushSubscription(registration: ServiceWorkerRegistration) {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim().replace(
    /^["']|["']$/g,
    "",
  )
  if (!publicKey) {
    throw new Error(
      "Push is not configured. Missing NEXT_PUBLIC_VAPID_PUBLIC_KEY.",
    )
  }

  const existing = await registration.pushManager.getSubscription()
  if (existing) {
    // Reuse if still valid; otherwise drop and recreate (common after key/env changes).
    try {
      const keys = readSubscriptionKeys(existing)
      if (keys) return existing
    } catch {
      // fall through
    }
    await existing.unsubscribe().catch(() => {})
  }

  return registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  })
}

async function subscribePush(audience: Audience) {
  if (!window.isSecureContext) {
    throw new Error("Notifications require HTTPS (or localhost).")
  }

  if (!("Notification" in window) || !("PushManager" in window)) {
    throw new Error(
      "Push notifications are not supported in this browser. On iPhone, open the app from the Home Screen.",
    )
  }

  const permission = await Notification.requestPermission()
  if (permission !== "granted") {
    throw new Error(
      "Notification permission was denied. Enable it in iPhone Settings → Notifications.",
    )
  }

  const registration = await registerServiceWorker()
  if (!registration?.active && !registration?.pushManager) {
    throw new Error("Could not start the notification service worker.")
  }

  let subscription: PushSubscription
  try {
    subscription = await createPushSubscription(registration)
  } catch (err) {
    const message = (err as Error).message || "Push subscribe failed"
    if (/push service|abort|not supported/i.test(message)) {
      throw new Error(
        "iPhone could not create a push subscription. Make sure the app was added to the Home Screen and iOS is 16.4+.",
      )
    }
    throw new Error(message)
  }

  const keys = readSubscriptionKeys(subscription)
  if (!subscription.endpoint || !keys) {
    throw new Error("Could not read push subscription keys on this device.")
  }

  await apiPost(subscribePath(audience), {
    endpoint: subscription.endpoint,
    keys,
  })

  return subscription
}

async function unsubscribePush(audience: Audience) {
  const registration = await navigator.serviceWorker?.getRegistration()
  const subscription = await registration?.pushManager.getSubscription()
  if (!subscription) return

  await apiDelete(subscribePath(audience), { endpoint: subscription.endpoint })
  await subscription.unsubscribe().catch(() => {})
}

/**
 * Enables browser push + polls for new booking/assignment alerts.
 * Mount once in admin shell and driver dashboard.
 */
export function StaffNotificationManager({
  audience,
}: {
  audience: Audience
}) {
  const [enabled, setEnabled] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [supported, setSupported] = React.useState(true)
  const seenRef = React.useRef<Set<string>>(new Set())
  const sinceRef = React.useRef(new Date().toISOString())
  const primedRef = React.useRef(false)

  React.useEffect(() => {
    const ok =
      typeof window !== "undefined" &&
      window.isSecureContext &&
      "Notification" in window &&
      "serviceWorker" in navigator &&
      "PushManager" in window
    setSupported(ok)
    if (!ok) return

    void (async () => {
      try {
        const reg = await navigator.serviceWorker.getRegistration()
        const sub = await reg?.pushManager.getSubscription()
        setEnabled(Boolean(sub) && Notification.permission === "granted")
      } catch {
        setEnabled(false)
      }
    })()
  }, [])

  React.useEffect(() => {
    const alertsPath =
      audience === "admin"
        ? "/api/admin/bookings/alerts"
        : "/api/driver/bookings/alerts"

    let cancelled = false

    async function poll() {
      try {
        const data = await fetcher<{
          serverTime: string
          bookings: AlertBooking[]
        }>(`${alertsPath}?since=${encodeURIComponent(sinceRef.current)}`)

        if (cancelled) return

        // First successful poll only advances the cursor (avoid toast storm on mount).
        if (!primedRef.current) {
          primedRef.current = true
          sinceRef.current = data.serverTime
          for (const b of data.bookings) seenRef.current.add(b.id)
          return
        }

        for (const booking of data.bookings) {
          if (seenRef.current.has(booking.id)) continue
          seenRef.current.add(booking.id)

          const title =
            audience === "admin" ? "New booking" : "New trip — accept or reject"

          toast.message(title, {
            description: `${booking.referenceCode} · ${booking.pickupAddress} → ${booking.dropoffAddress}`,
            duration: 8000,
          })

          if (
            Notification.permission === "granted" &&
            document.visibilityState === "hidden"
          ) {
            try {
              const reg = await navigator.serviceWorker.getRegistration()
              await reg?.showNotification(title, {
                body: `${booking.referenceCode}\n${booking.pickupAddress} → ${booking.dropoffAddress}`,
                tag: `alert-${booking.id}`,
                icon: "/icon.svg",
              })
            } catch {
              // ignore
            }
          }
        }

        sinceRef.current = data.serverTime
      } catch {
        // ignore transient poll errors
      }
    }

    void poll()
    const id = window.setInterval(() => void poll(), 15_000)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [audience])

  async function enable() {
    setBusy(true)
    try {
      await subscribePush(audience)
      setEnabled(true)
      toast.success("Notifications enabled on this device.")
    } catch (err) {
      toast.error((err as Error).message || "Could not enable notifications.")
    } finally {
      setBusy(false)
    }
  }

  async function disable() {
    setBusy(true)
    try {
      await unsubscribePush(audience)
      setEnabled(false)
      toast.success("Notifications disabled on this device.")
    } catch (err) {
      toast.error((err as Error).message || "Could not disable notifications.")
    } finally {
      setBusy(false)
    }
  }

  if (!supported) {
    // Still show the control so iPhone users get a clear explanation.
    return (
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="size-10 shrink-0 touch-manipulation sm:size-8"
        aria-label="Notifications unavailable"
        onClick={() =>
          toast.error(
            "On iPhone, open this site from the Home Screen (Add to Home Screen), then tap the bell again. iOS 16.4+ required.",
          )
        }
      >
        <BellOffIcon />
      </Button>
    )
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className={cn("size-10 shrink-0 touch-manipulation sm:size-8")}
      aria-label={enabled ? "Disable notifications" : "Enable notifications"}
      disabled={busy}
      onClick={() => void (enabled ? disable() : enable())}
    >
      {busy ? (
        <BellRingIcon className="animate-pulse" />
      ) : enabled ? (
        <BellIcon />
      ) : (
        <BellOffIcon />
      )}
    </Button>
  )
}
