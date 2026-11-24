"use client"

import { useEffect } from "react"

import { scrollToHashId } from "@/lib/smooth-hash-scroll"

/** Smooth-scrolls to the URL hash on initial mount when landing on /#section. */
export function InitialHashScroll() {
  useEffect(() => {
    const id = window.location.hash.replace(/^#/, "")
    if (!id) return
    const frame = window.requestAnimationFrame(() => {
      scrollToHashId(id, { updateUrl: false })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [])

  return null
}
