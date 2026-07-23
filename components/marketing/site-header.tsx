"use client"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { MenuIcon, XIcon } from "lucide-react"

import { HashLink } from "@/components/marketing/hash-link"
import { LanguageSwitcher } from "@/components/marketing/language-switcher"
import { MarketingContainer } from "@/components/marketing/marketing-container"
import { cn } from "@/lib/utils"

const NAV = [
  { href: "/#book", label: "Book" },
  { href: "/#destinations", label: "Destinations" },
  { href: "/driver", label: "Drivers" },
  { href: "/#safety", label: "Safety" },
] as const

export function SiteHeader({ className }: { className?: string }) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <header className={cn("sticky top-4 z-50", className)}>
      <MarketingContainer>
        <div className="relative grid h-20 grid-cols-[1fr_auto] items-center gap-4 rounded-full border border-border bg-white px-6 shadow-lg sm:px-8">
          {/* Left: logo */}
          <div className="flex min-w-0 items-center">
            <Link
              href="/"
              className="flex shrink-0 items-center gap-2.5 font-brand text-xl font-extrabold tracking-tight text-brand sm:gap-3 sm:text-2xl"
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
          </div>

          {/* Right: menu + language + My booking */}
          <div className="flex items-center gap-4 sm:gap-6 lg:gap-8">
            <nav className="hidden items-center gap-6 md:flex lg:gap-8">
              {NAV.map(({ href, label }) =>
                href.includes("#") ? (
                  <HashLink
                    key={label}
                    href={href}
                    className="text-sm font-bold text-brand transition-colors hover:text-primary"
                  >
                    {label}
                  </HashLink>
                ) : (
                  <Link
                    key={label}
                    href={href}
                    className="text-sm font-bold text-brand transition-colors hover:text-primary"
                  >
                    {label}
                  </Link>
                )
              )}
            </nav>

            <LanguageSwitcher className="hidden md:inline-block" />

            <Link
              href="/my-booking"
              className="rounded-full bg-primary px-4 py-2 text-xs font-extrabold tracking-wide text-primary-foreground shadow-md shadow-primary/20 transition-colors hover:bg-brand-accent-hover sm:px-6 sm:py-2.5 sm:text-sm"
            >
              My booking
            </Link>

            <button
              type="button"
              className="p-2 text-brand md:hidden"
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
                {NAV.map(({ href, label }) =>
                  href.includes("#") ? (
                    <HashLink
                      key={label}
                      href={href}
                      className="rounded-xl px-4 py-3 text-sm font-bold text-brand transition-colors hover:bg-accent hover:text-primary"
                      onClick={() => setMenuOpen(false)}
                    >
                      {label}
                    </HashLink>
                  ) : (
                    <Link
                      key={label}
                      href={href}
                      className="rounded-xl px-4 py-3 text-sm font-bold text-brand transition-colors hover:bg-accent hover:text-primary"
                      onClick={() => setMenuOpen(false)}
                    >
                      {label}
                    </Link>
                  )
                )}
                <div className="mt-2 border-t border-border px-2 pt-3">
                  <p className="mb-2 px-2 text-[10px] font-bold tracking-[0.14em] text-muted-foreground uppercase">
                    Language
                  </p>
                  <LanguageSwitcher variant="chips" className="px-2" />
                </div>
              </nav>
            </div>
          ) : null}
        </div>
      </MarketingContainer>
    </header>
  )
}
