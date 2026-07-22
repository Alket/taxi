"use client"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { GlobeIcon, MenuIcon, XIcon } from "lucide-react"

import { MarketingContainer } from "@/components/marketing/marketing-container"
import { cn } from "@/lib/utils"

const LEFT_NAV = [
  { href: "/#book", label: "Book" },
  { href: "/#destinations", label: "Destinations" },
  { href: "/driver", label: "Drivers" },
] as const

const RIGHT_NAV = [
  { href: "/#safety", label: "Safety" },
] as const

export function SiteHeader({ className }: { className?: string }) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <header className={cn("sticky top-4 z-50", className)}>
      <MarketingContainer>
        <div className="relative flex h-20 items-center justify-between rounded-full border border-border bg-white px-6 shadow-lg sm:px-8">
          <div className="flex items-center gap-10">
            <Link
              href="/"
              className="flex items-center gap-2.5 font-brand text-xl font-extrabold tracking-tight text-brand sm:gap-3 sm:text-2xl"
            >
              <Image
                src="/marketing/logo.svg"
                alt=""
                width={207}
                height={150}
                className="h-9 w-auto shrink-0 sm:h-10"
                priority
              />
            </Link>

            <nav className="hidden items-center gap-8 text-sm font-semibold text-muted-foreground md:flex">
              {LEFT_NAV.map(({ href, label }) => (
                <Link
                  key={label}
                  href={href}
                  className="transition-colors hover:text-primary"
                >
                  {label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="hidden items-center gap-8 text-sm font-semibold text-muted-foreground md:flex">
            {RIGHT_NAV.map(({ href, label }) => (
              <Link
                key={label}
                href={href}
                className="transition-colors hover:text-primary"
              >
                {label}
              </Link>
            ))}

            <button
              type="button"
              className="cursor-pointer text-muted-foreground transition-colors hover:text-brand"
              aria-label="Select language"
            >
              <GlobeIcon className="size-5" strokeWidth={1.8} />
            </button>

            <Link
              href="/my-booking"
              className="rounded-full bg-primary px-6 py-2.5 text-sm font-extrabold tracking-wide text-primary-foreground shadow-md shadow-primary/20 transition-colors hover:bg-brand-accent-hover"
            >
              My booking
            </Link>
          </div>

          <div className="flex items-center gap-3 md:hidden">
            <Link
              href="/my-booking"
              className="rounded-full bg-primary px-4 py-2 text-xs font-extrabold tracking-wide text-primary-foreground"
            >
              My booking
            </Link>
            <button
              type="button"
              className="p-2 text-brand"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
            >
              {menuOpen ? (
                <XIcon className="size-6" strokeWidth={2} />
              ) : (
                <MenuIcon className="size-6" strokeWidth={2} />
              )}
            </button>
          </div>

          {menuOpen ? (
            <div className="absolute top-[calc(100%+0.75rem)] right-0 left-0 rounded-3xl border border-border bg-white p-4 shadow-lg md:hidden">
              <nav className="flex flex-col gap-1">
                {[...LEFT_NAV, ...RIGHT_NAV].map(({ href, label }) => (
                  <Link
                    key={label}
                    href={href}
                    className="rounded-xl px-4 py-3 text-sm font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-primary"
                    onClick={() => setMenuOpen(false)}
                  >
                    {label}
                  </Link>
                ))}
                <Link
                  href="/my-booking"
                  className="mt-2 rounded-full bg-primary px-4 py-3 text-center text-sm font-extrabold text-primary-foreground"
                  onClick={() => setMenuOpen(false)}
                >
                  My booking
                </Link>
              </nav>
            </div>
          ) : null}
        </div>
      </MarketingContainer>
    </header>
  )
}
