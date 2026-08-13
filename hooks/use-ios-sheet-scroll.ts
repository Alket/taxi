"use client"

import * as React from "react"

function isAppleTouchDevice() {
  if (typeof navigator === "undefined") return false
  if (/iP(hone|od|ad)/.test(navigator.userAgent)) return true
  return (
    navigator.platform === "MacIntel" &&
    typeof navigator.maxTouchPoints === "number" &&
    navigator.maxTouchPoints > 1
  )
}

/**
 * iOS Safari: native overflow scrolling inside dialogs is often dead until an
 * input is focused. This hook:
 * 1. Blocks document/body rubber-band scroll while open
 * 2. Manually drives `scrollTop` on the allowlisted scroll container
 *
 * Mark the list with `data-ios-sheet-scroll` (also used as the ref target).
 */
export function useIosSheetScroll(
  enabled: boolean,
  scrollRef: React.RefObject<HTMLElement | null>,
) {
  const apple = React.useMemo(() => isAppleTouchDevice(), [])
  const active = enabled && apple

  React.useEffect(() => {
    if (!active) return

    const scrollY = window.scrollY
    const html = document.documentElement
    const body = document.body
    const prevHtmlOverflow = html.style.overflow
    const prevBodyOverflow = body.style.overflow
    const prevBodyPosition = body.style.position
    const prevBodyTop = body.style.top
    const prevBodyLeft = body.style.left
    const prevBodyRight = body.style.right
    const prevBodyWidth = body.style.width
    const prevBodyTouchAction = body.style.touchAction

    // Freeze the page behind the full-screen sheet without relying on
    // overflow:hidden alone (that kills nested scroll on iOS).
    html.style.overflow = "hidden"
    body.style.position = "fixed"
    body.style.top = `-${scrollY}px`
    body.style.left = "0"
    body.style.right = "0"
    body.style.width = "100%"
    body.style.overflow = "hidden"
    body.style.touchAction = "none"

    let lastY = 0
    let tracking = false

    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) return
      const el = scrollRef.current
      const target = event.target
      if (!(target instanceof Element) || !el || !el.contains(target)) {
        tracking = false
        return
      }
      tracking = true
      lastY = event.touches[0].clientY
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
        // Touches on header/search/backdrop must not move the page.
        event.preventDefault()
        return
      }

      const y = event.touches[0].clientY
      const delta = lastY - y
      lastY = y

      const max = Math.max(0, el.scrollHeight - el.clientHeight)
      if (max <= 0) {
        event.preventDefault()
        return
      }

      const next = Math.min(max, Math.max(0, el.scrollTop + delta))
      el.scrollTop = next
      // Always prevent — we own scrolling so the body never moves.
      event.preventDefault()
    }

    const onTouchEnd = () => {
      tracking = false
    }

    // capture + non-passive so preventDefault works before Base UI handlers.
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
      document.removeEventListener("touchstart", onTouchStart, true)
      document.removeEventListener("touchmove", onTouchMove, true)
      document.removeEventListener("touchend", onTouchEnd, true)
      document.removeEventListener("touchcancel", onTouchEnd, true)

      html.style.overflow = prevHtmlOverflow
      body.style.overflow = prevBodyOverflow
      body.style.position = prevBodyPosition
      body.style.top = prevBodyTop
      body.style.left = prevBodyLeft
      body.style.right = prevBodyRight
      body.style.width = prevBodyWidth
      body.style.touchAction = prevBodyTouchAction
      window.scrollTo(0, scrollY)
    }
  }, [active, scrollRef])

  return active
}
