"use client"

import * as React from "react"

let lockCount = 0
let savedScrollY = 0
let savedBodyOverflow = ""
let savedBodyPosition = ""
let savedBodyTop = ""
let savedBodyLeft = ""
let savedBodyRight = ""
let savedBodyWidth = ""
let savedHtmlOverflow = ""
let usedFixedStrategy = false

function isIOS() {
  if (typeof navigator === "undefined") return false
  return /iP(hone|od|ad)/.test(navigator.userAgent)
}

function applyLock() {
  if (typeof document === "undefined") return
  if (lockCount === 0) {
    savedScrollY = window.scrollY
    savedBodyOverflow = document.body.style.overflow
    savedBodyPosition = document.body.style.position
    savedBodyTop = document.body.style.top
    savedBodyLeft = document.body.style.left
    savedBodyRight = document.body.style.right
    savedBodyWidth = document.body.style.width
    savedHtmlOverflow = document.documentElement.style.overflow

    document.documentElement.style.overflow = "hidden"
    document.body.style.overflow = "hidden"

    // iOS: never use position:fixed or touch-action:none — both break
    // nested overflow scrolling inside full-screen sheets until an input
    // is focused. Overflow:hidden alone is enough with a 100dvh modal.
    usedFixedStrategy = !isIOS()
    if (usedFixedStrategy) {
      document.body.style.position = "fixed"
      document.body.style.top = `-${savedScrollY}px`
      document.body.style.left = "0"
      document.body.style.right = "0"
      document.body.style.width = "100%"
    }
  }
  lockCount += 1
}

function releaseLock() {
  if (typeof document === "undefined") return
  lockCount = Math.max(0, lockCount - 1)
  if (lockCount > 0) return

  document.documentElement.style.overflow = savedHtmlOverflow
  document.body.style.overflow = savedBodyOverflow

  if (usedFixedStrategy) {
    document.body.style.position = savedBodyPosition
    document.body.style.top = savedBodyTop
    document.body.style.left = savedBodyLeft
    document.body.style.right = savedBodyRight
    document.body.style.width = savedBodyWidth
    window.scrollTo(0, savedScrollY)
  }

  usedFixedStrategy = false
}

/**
 * Locks document scroll while `locked` is true.
 * Uses a ref-count so nested / chained modals stay locked without a flash.
 */
export function useBodyScrollLock(locked: boolean) {
  React.useEffect(() => {
    if (!locked) return
    applyLock()
    return () => releaseLock()
  }, [locked])
}
