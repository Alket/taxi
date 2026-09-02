"use client"

import { useSearchParams } from "next/navigation"
import { useEffect, useRef } from "react"

declare global {
  interface Window {
    TrustpilotObject?: string
    tp?: TrustpilotCommand
  }
}

type TrustpilotCommand = {
  (...args: unknown[]): void
  q?: unknown[]
}

function ensureTpQueue() {
  if (typeof window.tp === "function") return
  const tp = function tpCommand(...args: unknown[]) {
    ;(tp.q = tp.q || []).push(args)
  } as TrustpilotCommand
  tp.q = []
  window.tp = tp
  window.TrustpilotObject = "tp"
}

/**
 * After checkout, payment APIs set an HttpOnly invite cookie. This component
 * claims once (cookie + reference), then calls createInvitation. Booker email
 * is never embedded in page HTML. Stripe 3DS returns may mint the cookie via
 * confirm-deposit using payment_intent + client_secret from the redirect URL.
 */
export function TrustpilotCreateInvitation({
  referenceId,
}: {
  referenceId: string
}) {
  const searchParams = useSearchParams()
  const fired = useRef(false)

  useEffect(() => {
    const ref = referenceId.trim().toUpperCase()
    if (!ref || fired.current) return

    const storageKey = `tp_invite_${ref}`
    try {
      if (sessionStorage.getItem(storageKey) === "1") return
    } catch {
      // private mode — still attempt once this mount
    }

    fired.current = true
    let cancelled = false

    async function run() {
      try {
        const paymentIntentId = searchParams.get("payment_intent")?.trim() || ""
        const clientSecret =
          searchParams.get("payment_intent_client_secret")?.trim() || ""

        // Stripe redirect return: mint HttpOnly invite cookie (requires secret).
        if (paymentIntentId && clientSecret) {
          await fetch("/api/payments/confirm-deposit", {
            method: "POST",
            credentials: "same-origin",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              referenceCode: ref,
              paymentIntentId,
              paymentIntentClientSecret: clientSecret,
            }),
          })
        }

        if (cancelled) return

        const res = await fetch("/api/bookings/trustpilot-invite", {
          method: "POST",
          credentials: "same-origin",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ referenceCode: ref }),
        })
        if (!res.ok || cancelled) return

        const data = (await res.json()) as {
          recipientEmail?: string
          recipientName?: string
          referenceId?: string
        }
        const email = data.recipientEmail?.trim()
        if (!email || cancelled) return

        ensureTpQueue()
        window.tp?.("createInvitation", {
          recipientEmail: email,
          recipientName: (data.recipientName || email).trim(),
          referenceId: (data.referenceId || ref).trim(),
          source: "InvitationScript",
        })

        try {
          sessionStorage.setItem(storageKey, "1")
        } catch {
          // ignore
        }

        try {
          const url = new URL(window.location.href)
          let changed = false
          for (const key of [
            "tp",
            "payment_intent",
            "payment_intent_client_secret",
          ]) {
            if (url.searchParams.has(key)) {
              url.searchParams.delete(key)
              changed = true
            }
          }
          if (changed) {
            window.history.replaceState(
              {},
              "",
              url.pathname + url.search + url.hash,
            )
          }
        } catch {
          // ignore
        }
      } catch {
        // ignore — booking confirmation must not fail on invite errors
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [referenceId, searchParams])

  return null
}
