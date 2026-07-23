"use client"

import Link from "next/link"

import { HashLink } from "@/components/marketing/hash-link"
import { MarketingContainer } from "@/components/marketing/marketing-container"

const NAV_LINKS = [
  { href: "/#book", label: "Book a transfer" },
  { href: "/my-booking", label: "My booking" },
  { href: "/cancellation-policy", label: "Cancellation Policy" },
  { href: "#", label: "About" },
  { href: "#", label: "Support" },
  { href: "#", label: "Privacy Policy" },
  { href: "#", label: "Terms of Service" },
] as const

export function SiteFooter() {
  return (
    <footer className="bg-[color-mix(in_oklab,var(--accent)_70%,transparent)] py-16 text-brand">
      <MarketingContainer>
        <div className="flex flex-col items-start justify-between gap-10 border-b border-border pb-12 lg:flex-row lg:items-center">
          <div>
            <span className="mb-2 block font-brand text-2xl font-extrabold tracking-tight text-brand">
              Albania Transfers
            </span>
            <p className="max-w-md text-sm text-muted-foreground">
              Safe, reliable, and comfortable airport transfers and professional
              rides across Albania.
            </p>
          </div>

          <nav className="flex flex-wrap gap-x-8 gap-y-3 text-sm font-medium text-muted-foreground">
            {NAV_LINKS.map(({ href, label }) =>
              href.startsWith("/#") ? (
                <HashLink
                  key={label}
                  href={href}
                  className="transition-colors hover:text-primary"
                >
                  {label}
                </HashLink>
              ) : href.startsWith("/") ? (
                <Link
                  key={label}
                  href={href}
                  className="transition-colors hover:text-primary"
                >
                  {label}
                </Link>
              ) : (
                <a
                  key={label}
                  href={href}
                  className="transition-colors hover:text-primary"
                >
                  {label}
                </a>
              )
            )}
          </nav>
        </div>

        <div className="flex flex-col items-center justify-between gap-4 pt-8 text-xs text-muted-foreground sm:flex-row">
          <p>
            &copy; {new Date().getFullYear()} Albania Transfers. All rights
            reserved.
          </p>
          <p>Fixed prices · Meet-and-greet · Flight tracking</p>
        </div>
      </MarketingContainer>
    </footer>
  )
}
