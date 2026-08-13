"use client"

import * as React from "react"

import { useBodyScrollLock } from "@/hooks/use-body-scroll-lock"

function isAppleTouchDevice() {
  if (typeof navigator === "undefined") return false
  if (/iP(hone|od|ad)/.test(navigator.userAgent)) return true
  return (
    navigator.platform === "MacIntel" &&
    typeof navigator.maxTouchPoints === "number" &&
    navigator.maxTouchPoints > 1
  )
}

function clampScroll(el: HTMLElement, next: number) {
  const max = Math.max(0, el.scrollHeight - el.clientHeight)
  const clamped = Math.min(max, Math.max(0, next))
  el.scrollTop = clamped
  return { max, clamped, hitEdge: clamped !== next }
}

/**
 * iOS Safari: native overflow scrolling inside dialogs is often dead until an
 * input is focused. This hook:
 * 1. Freezes the page via shared body scroll lock (`fixed`)
 * 2. Manually drives list scroll with finger tracking + momentum inertia
 */
export function useIosSheetScroll(
  enabled: boolean,
  scrollRef: React.RefObject<HTMLElement | null>,
) {
  const apple = React.useMemo(() => isAppleTouchDevice(), [])
  const active = enabled && apple

  // Shared lock — coordinates with other sheets and forceUnlock on /book.
  useBodyScrollLock(active, "fixed")

  React.useEffect(() => {
    if (!active) return

    let lastY = 0
    let lastTime = 0
    let velocity = 0 // px / ms — positive scrolls content upward
    let tracking = false
    let momentumRaf = 0
    let pendingDelta = 0
    let dragRaf = 0

    const stopMomentum = () => {
      if (!momentumRaf) return
      cancelAnimationFrame(momentumRaf)
      momentumRaf = 0
    }

    const flushDrag = () => {
      dragRaf = 0
      const el = scrollRef.current
      if (!el || pendingDelta === 0) {
        pendingDelta = 0
        return
      }
      const delta = pendingDelta
      pendingDelta = 0
      clampScroll(el, el.scrollTop + delta)
    }

    const startMomentum = () => {
      stopMomentum()
      const el = scrollRef.current
      if (!el) return

      if (Math.abs(velocity) < 0.04) {
        velocity = 0
        return
      }

      let v = Math.max(-2.8, Math.min(2.8, velocity))
      let prev = performance.now()
      const frictionMs = 300

      const tick = (now: number) => {
        const current = scrollRef.current
        if (!current) {
          momentumRaf = 0
          return
        }

        const dt = Math.min(34, now - prev)
        prev = now
        v *= Math.exp(-dt / frictionMs)
        const { hitEdge } = clampScroll(current, current.scrollTop + v * dt)

        if (hitEdge || Math.abs(v) < 0.02) {
          velocity = 0
          momentumRaf = 0
          return
        }

        momentumRaf = requestAnimationFrame(tick)
      }

      momentumRaf = requestAnimationFrame(tick)
    }

    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) return
      const el = scrollRef.current
      const target = event.target
      if (!(target instanceof Element) || !el || !el.contains(target)) {
        tracking = false
        return
      }

      stopMomentum()
      if (dragRaf) {
        cancelAnimationFrame(dragRaf)
        dragRaf = 0
      }
      pendingDelta = 0
      tracking = true
      lastY = event.touches[0].clientY
      lastTime = performance.now()
      velocity = 0
    }

    const onTouchMove = (event: TouchEvent) => {
      if (event.touches.length !== 1) return

      const el = scrollRef.current
      const target = event.target
      const inside =
        el != null &&
        target instanceof Element &&
        (el === target || el.contains(target))

      if (!inside || !el || !tracking) {
        event.preventDefault()
        return
      }

      const y = event.touches[0].clientY
      const now = performance.now()
      const delta = lastY - y
      const dt = now - lastTime

      if (dt > 0 && dt < 64) {
        const instant = delta / dt
        velocity = velocity * 0.6 + instant * 0.4
      }

      lastY = y
      lastTime = now
      pendingDelta += delta

      if (!dragRaf) {
        dragRaf = requestAnimationFrame(flushDrag)
      }

      event.preventDefault()
    }

    const onTouchEnd = () => {
      if (!tracking) return
      tracking = false
      if (dragRaf) {
        cancelAnimationFrame(dragRaf)
        flushDrag()
      }
      startMomentum()
    }

    document.addEventListener("touchstart", onTouchStart, {
      capture: true,
      passive: true,
    })
    document.addEventListener("touchmove", onTouchMove, {
      capture: true,
      passive: false,
    })
    document.addEventListener("touchend", onTouchEnd, {
      capture: true,
      passive: true,
    })
    document.addEventListener("touchcancel", onTouchEnd, {
      capture: true,
      passive: true,
    })

    return () => {
      stopMomentum()
      if (dragRaf) cancelAnimationFrame(dragRaf)
      document.removeEventListener("touchstart", onTouchStart, true)
      document.removeEventListener("touchmove", onTouchMove, true)
      document.removeEventListener("touchend", onTouchEnd, true)
      document.removeEventListener("touchcancel", onTouchEnd, true)
    }
  }, [active, scrollRef])

  return active
}
