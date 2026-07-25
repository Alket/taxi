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
    <footer className="bg-[color-mix(in_oklab,var(--accent)_70%,transparent)] pt-10 pb-[max(2.5rem,env(safe-area-inset-bottom))] text-brand md:py-16">
      <MarketingContainer>
        <div className="flex flex-col gap-8 border-b border-border pb-8 md:gap-10 md:pb-12 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <span className="mb-2 block font-brand text-xl font-extrabold tracking-tight text-brand sm:text-2xl">
              Albania Transfers
            </span>
            <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
              Safe, reliable, and comfortable airport transfers and professional
              rides across Albania.
            </p>
          </div>

          <nav className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm font-medium text-muted-foreground sm:flex sm:flex-wrap sm:gap-x-8">
            {NAV_LINKS.map(({ href, label }) =>
              href.startsWith("/#") ? (
                <HashLink
                  key={label}
                  href={href}
                  className="py-0.5 transition-colors hover:text-primary"
                >
                  {label}
                </HashLink>
              ) : href.startsWith("/") ? (
                <Link
                  key={label}
                  href={href}
                  className="py-0.5 transition-colors hover:text-primary"
                >
                  {label}
                </Link>
              ) : (
                <a
                  key={label}
                  href={href}
                  className="py-0.5 transition-colors hover:text-primary"
                >
                  {label}
                </a>
              ),
            )}
          </nav>
        </div>

        <div className="flex flex-col gap-2 pt-6 text-center text-xs leading-relaxed text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:pt-8 sm:text-left">
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
