"use client"

import * as React from "react"

type LockStrategy = "auto" | "fixed" | "overflow"

let lockCount = 0
let fixedCount = 0
let savedScrollY = 0
let savedBodyOverflow = ""
let savedBodyOverflowX = ""
let savedBodyOverflowY = ""
let savedBodyPosition = ""
let savedBodyTop = ""
let savedBodyLeft = ""
let savedBodyRight = ""
let savedBodyWidth = ""
let savedBodyHeight = ""
let savedBodyBoxSizing = ""
let savedBodyTouchAction = ""
let savedBodyScrollBehavior = ""
let savedHtmlOverflow = ""
let savedHtmlOverflowX = ""
let savedHtmlOverflowY = ""
let savedHtmlScrollbarGutter = ""
let savedHtmlScrollBehavior = ""
let stylesCaptured = false

function isIOS() {
  if (typeof navigator === "undefined") return false
  if (/iP(hone|od|ad)/.test(navigator.userAgent)) return true
  return (
    navigator.platform === "MacIntel" &&
    typeof navigator.maxTouchPoints === "number" &&
    navigator.maxTouchPoints > 1
  )
}

function wantsFixed(strategy: LockStrategy) {
  if (strategy === "fixed") return true
  if (strategy === "overflow") return false
  // auto: fixed on non-iOS; overflow-only on iOS (safer for most sheets)
  return !isIOS()
}

function captureStyles() {
  if (stylesCaptured || typeof document === "undefined") return
  const html = document.documentElement
  const body = document.body
  savedScrollY = window.scrollY
  savedHtmlOverflow = html.style.overflow
  savedHtmlOverflowX = html.style.overflowX
  savedHtmlOverflowY = html.style.overflowY
  savedHtmlScrollbarGutter = html.style.scrollbarGutter
  savedHtmlScrollBehavior = html.style.scrollBehavior
  savedBodyOverflow = body.style.overflow
  savedBodyOverflowX = body.style.overflowX
  savedBodyOverflowY = body.style.overflowY
  savedBodyPosition = body.style.position
  savedBodyTop = body.style.top
  savedBodyLeft = body.style.left
  savedBodyRight = body.style.right
  savedBodyWidth = body.style.width
  savedBodyHeight = body.style.height
  savedBodyBoxSizing = body.style.boxSizing
  savedBodyTouchAction = body.style.touchAction
  savedBodyScrollBehavior = body.style.scrollBehavior
  stylesCaptured = true
}

function applyOverflowLock() {
  const html = document.documentElement
  const body = document.body
  html.style.overflow = "hidden"
  body.style.overflow = "hidden"
}

function applyFixedLock() {
  const body = document.body
  body.style.position = "fixed"
  body.style.top = `-${savedScrollY}px`
  body.style.left = "0"
  body.style.right = "0"
  body.style.width = "100%"
  body.style.touchAction = "none"
}

function clearFixedLock() {
  const body = document.body
  body.style.position = savedBodyPosition
  body.style.top = savedBodyTop
  body.style.left = savedBodyLeft
  body.style.right = savedBodyRight
  body.style.width = savedBodyWidth
  body.style.touchAction = savedBodyTouchAction
}

function restoreAllStyles() {
  if (typeof document === "undefined") return
  const html = document.documentElement
  const body = document.body

  html.style.overflow = savedHtmlOverflow
  html.style.overflowX = savedHtmlOverflowX
  html.style.overflowY = savedHtmlOverflowY
  html.style.scrollbarGutter = savedHtmlScrollbarGutter
  html.style.scrollBehavior = savedHtmlScrollBehavior
  html.removeAttribute("data-base-ui-scroll-locked")

  body.style.overflow = savedBodyOverflow
  body.style.overflowX = savedBodyOverflowX
  body.style.overflowY = savedBodyOverflowY
  body.style.position = savedBodyPosition
  body.style.top = savedBodyTop
  body.style.left = savedBodyLeft
  body.style.right = savedBodyRight
  body.style.width = savedBodyWidth
  body.style.height = savedBodyHeight
  body.style.boxSizing = savedBodyBoxSizing
  body.style.touchAction = savedBodyTouchAction
  body.style.scrollBehavior = savedBodyScrollBehavior

  window.scrollTo(0, savedScrollY)
  stylesCaptured = false
}

function applyLock(strategy: LockStrategy) {
  if (typeof document === "undefined") return
  if (lockCount === 0) {
    captureStyles()
    applyOverflowLock()
  }
  lockCount += 1

  if (wantsFixed(strategy)) {
    const wasFixed = fixedCount > 0
    fixedCount += 1
    if (!wasFixed) applyFixedLock()
  }
}

function releaseLock(strategy: LockStrategy) {
  if (typeof document === "undefined") return

  // forceUnlockDocumentScroll already cleared everything — ignore stale releases
  // from unmounting sheets after navigation.
  if (lockCount <= 0) {
    fixedCount = 0
    return
  }

  if (wantsFixed(strategy)) {
    fixedCount = Math.max(0, fixedCount - 1)
    if (fixedCount === 0 && lockCount > 1) {
      // Other locks still active — drop fixed freeze, keep overflow lock.
      clearFixedLock()
      window.scrollTo(0, savedScrollY)
    }
  }

  lockCount = Math.max(0, lockCount - 1)
  if (lockCount === 0) {
    fixedCount = 0
    restoreAllStyles()
  }
}

/**
 * Hard-clear document scroll locks left behind by sheets / Base UI / navigation.
 * Safe to call on route entry (e.g. /book).
 */
export function forceUnlockDocumentScroll(options?: { scrollTop?: number }) {
  if (typeof document === "undefined") return

  lockCount = 0
  fixedCount = 0
  stylesCaptured = false

  const html = document.documentElement
  const body = document.body

  html.style.overflow = ""
  html.style.overflowX = ""
  html.style.overflowY = ""
  html.style.scrollbarGutter = ""
  html.style.scrollBehavior = ""
  html.removeAttribute("data-base-ui-scroll-locked")

  body.style.overflow = ""
  body.style.overflowX = ""
  body.style.overflowY = ""
  body.style.position = ""
  body.style.top = ""
  body.style.left = ""
  body.style.right = ""
  body.style.width = ""
  body.style.height = ""
  body.style.boxSizing = ""
  body.style.touchAction = ""
  body.style.scrollBehavior = ""

  const top = options?.scrollTop ?? window.scrollY
  window.scrollTo(0, top)
}

/**
 * Locks document scroll while `locked` is true.
 * Uses a ref-count so nested / chained modals stay locked without a flash.
 *
 * - `auto` (default): position:fixed on non-iOS; overflow-only on iOS
 * - `fixed`: always freeze with position:fixed (iOS destination sheet)
 * - `overflow`: overflow:hidden only
 */
export function useBodyScrollLock(
  locked: boolean,
  strategy: LockStrategy = "auto",
) {
  React.useEffect(() => {
    if (!locked) return
    applyLock(strategy)
    return () => releaseLock(strategy)
  }, [locked, strategy])
}
