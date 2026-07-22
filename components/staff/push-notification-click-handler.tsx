"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

/**
 * Handles push notification taps while the PWA/tab is already open.
 * The service worker posts NOTIFICATION_CLICK when client.navigate is unavailable.
 */
export function PushNotificationClickHandler() {
  const router = useRouter()

  React.useEffect(() => {
    if (!("serviceWorker" in navigator)) return

    function onMessage(event: MessageEvent) {
      const data = event.data as { type?: string; url?: string } | null
      if (!data || data.type !== "NOTIFICATION_CLICK" || !data.url) return

      try {
        const next = new URL(data.url, window.location.origin)
        router.push(`${next.pathname}${next.search}${next.hash}`)
      } catch {
        router.push(data.url)
      }
    }

    navigator.serviceWorker.addEventListener("message", onMessage)
    return () => {
      navigator.serviceWorker.removeEventListener("message", onMessage)
    }
  }, [router])

  return null
}
