"use client"

import Link from "next/link"
import type { ComponentProps, MouseEvent } from "react"

import { getHashId, trySmoothHashNavigation } from "@/lib/smooth-hash-scroll"

type HashLinkProps = ComponentProps<typeof Link>

/**
 * Next.js Link that smooth-scrolls to in-page hashes when the target is present.
 * Falls through to normal navigation when the section is on another page.
 */
export function HashLink({ href, onClick, ...props }: HashLinkProps) {
  const hrefStr = typeof href === "string" ? href : href.pathname ?? ""

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event)
    if (event.defaultPrevented) return

    const hashId = getHashId(hrefStr)
    if (!hashId) return

    if (trySmoothHashNavigation(hrefStr)) {
      event.preventDefault()
    }
  }

  return <Link href={href} onClick={handleClick} {...props} />
}
