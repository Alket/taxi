"use client"

import { useEffect, useRef, useState } from "react"

declare global {
  interface Window {
    Trustpilot?: {
      loadFromElement: (element: Element, forceReload?: boolean) => void
    }
  }
}

/**
 * TrustBox Review Collector. Mounted client-only so Trustpilot’s bootstrap
 * (which swaps the fallback <a> for an iframe) cannot cause a hydration mismatch.
 *
 * Trustpilot centers content inside a 100%-wide iframe — use a compact pixel
 * width + flex-start so the whole box sits on the left.
 */
export function TrustpilotReviewCollector({
  className,
  /** Desktop can pass a larger box; mobile keeps the default. */
  widthPx = 220,
  heightPx = 52,
}: {
  className?: string
  widthPx?: number
  heightPx?: number
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  // Only initialize when actually visible in the active breakpoint (avoids
  // mounting a second hidden iframe when rendered in both mobile & desktop hero).
  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    if (typeof IntersectionObserver === "undefined") {
      setVisible(true)
      return
    }

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true)
          io.disconnect()
        }
      },
      { rootMargin: "100px" },
    )
    io.observe(host)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    if (!visible) return
    const host = hostRef.current
    if (!host) return

    host.replaceChildren()

    const width = `${widthPx}px`
    const height = `${heightPx}px`

    const widget = document.createElement("div")
    widget.className = "trustpilot-widget"
    widget.setAttribute("data-locale", "en-US")
    widget.setAttribute("data-template-id", "56278e9abfbbba0bdcd568bc")
    widget.setAttribute("data-businessunit-id", "6a97f31baab12caba2587a12")
    widget.setAttribute("data-style-height", height)
    // Compact width — 100% makes Trustpilot center the stars in the full row
    widget.setAttribute("data-style-width", width)
    widget.setAttribute("data-token", "0b14810b-9ef3-48c4-a564-cc29887fca2b")
    widget.style.maxWidth = "fit-content"
    widget.style.width = width
    widget.style.margin = "0"
    widget.style.display = "block"

    const link = document.createElement("a")
    link.href = "https://www.trustpilot.com/review/landedalbania.com"
    link.target = "_blank"
    link.rel = "noopener noreferrer"
    link.textContent = "Trustpilot"
    widget.appendChild(link)
    host.appendChild(widget)

    const pinIframeLeft = () => {
      const iframe = widget.querySelector("iframe")
      if (!(iframe instanceof HTMLIFrameElement)) return false
      iframe.style.margin = "0"
      iframe.style.marginLeft = "0"
      iframe.style.marginRight = "auto"
      iframe.style.display = "block"
      iframe.style.float = "none"
      iframe.style.position = "relative"
      iframe.style.left = "0"
      return true
    }

    let pinned = false
    const observer = new MutationObserver(() => {
      if (pinIframeLeft()) {
        pinned = true
        observer.disconnect()
      }
    })
    observer.observe(widget, { childList: true, subtree: true })

    const load = () => {
      if (pinned || widget.querySelector("iframe")) {
        if (pinIframeLeft()) {
          pinned = true
          observer.disconnect()
        }
        return
      }
      if (window.Trustpilot?.loadFromElement) {
        window.Trustpilot.loadFromElement(widget, true)
        if (pinIframeLeft()) {
          pinned = true
          observer.disconnect()
        }
      }
    }

    load()
    const t1 = window.setTimeout(load, 500)
    const t2 = window.setTimeout(load, 1500)
    const t3 = window.setTimeout(load, 3000)

    return () => {
      window.clearTimeout(t1)
      window.clearTimeout(t2)
      window.clearTimeout(t3)
      observer.disconnect()
      host.replaceChildren()
    }
  }, [visible, widthPx, heightPx])

  return (
    <div
      ref={hostRef}
      className={className}
      style={{
        minHeight: heightPx,
        width: "fit-content",
        maxWidth: "100%",
        display: "flex",
        justifyContent: "flex-start",
        marginRight: "auto",
      }}
      aria-hidden={!visible}
    />
  )
}
