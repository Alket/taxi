"use client"

import Image from "next/image"
import Link from "next/link"

import { HashLink } from "@/components/marketing/hash-link"
import { MarketingContainer } from "@/components/marketing/marketing-container"
import { localePath } from "@/lib/i18n/locales"
import { useLocale, useT } from "@/lib/i18n/use-locale"
import { cn } from "@/lib/utils"

function PhoneIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={cn("size-[15px] shrink-0", className)}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.7a2 2 0 0 1-.5 2.1L8 9.7a16 16 0 0 0 6 6l1.2-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.5 2.7.6a2 2 0 0 1 1.7 2Z" />
    </svg>
  )
}

function MailIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={cn("size-[15px] shrink-0", className)}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M4 6l8 7 8-7" />
    </svg>
  )
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={cn("size-4 shrink-0 fill-current", className)}
    >
      <path d="M12 2a10 10 0 0 0-8.6 15L2 22l5.2-1.4A10 10 0 1 0 12 2z" />
    </svg>
  )
}

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4 fill-current">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
    </svg>
  )
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4 fill-current">
      <path d="M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.4h-1.3c-1.2 0-1.6.8-1.6 1.6V12h2.8l-.4 2.9h-2.4v7A10 10 0 0 0 22 12z" />
    </svg>
  )
}

const navLinkClass =
  "w-fit text-[14.5px] text-muted-foreground transition-[color,transform] duration-150 hover:translate-x-0.5 hover:text-brand"

const contactLinkClass = cn(
  navLinkClass,
  "inline-flex items-center gap-2 [&_svg]:text-brand-accent",
)

const socialIconClass =
  "flex size-9 items-center justify-center rounded-full border border-border bg-brand/5 text-brand transition-all duration-150 hover:-translate-y-0.5 hover:border-brand hover:bg-brand hover:text-white"

export function SiteFooterClient({
  companyName,
  supportPhone,
  supportEmail,
  whatsappUrl,
  telHref,
}: {
  companyName: string
  supportPhone: string
  supportEmail: string
  whatsappUrl: string | null
  telHref: string
}) {
  const locale = useLocale()
  const tr = useT()
  const year = new Date().getFullYear()

  const exploreLinks = [
    { href: localePath("/#book", locale), label: tr("nav.book") },
    {
      href: localePath("/destinations", locale),
      label: tr("nav.destinations"),
    },
    { href: localePath("/#safety", locale), label: tr("nav.safety") },
    { href: localePath("/#faq", locale), label: tr("nav.faq") },
  ] as const

  const legalLinks = [
    { href: "#", label: tr("footer.terms") },
    { href: "#", label: tr("footer.privacy") },
    { href: "#", label: tr("footer.cookies") },
    {
      href: localePath("/cancellation-policy", locale),
      label: tr("footer.cancellation"),
    },
  ] as const

  return (
    <footer className="border-t border-border bg-[color-mix(in_srgb,var(--brand-accent)_10%,white)] pt-14 pb-[max(2rem,env(safe-area-inset-bottom))] text-brand md:pt-20 md:pb-10">
      <MarketingContainer>
        <div className="mb-12 grid gap-12 md:mb-16 md:grid-cols-[1.2fr_2fr] md:gap-16">
          <div className="flex flex-col items-start">
            <Link
              href={localePath("/", locale)}
              className="mb-4 inline-flex items-center gap-2.5"
              aria-label={`${companyName} Homepage`}
            >
              <Image
                src="/marketing/logo.svg"
                alt=""
                width={207}
                height={150}
                className="h-9 w-auto shrink-0 sm:h-10"
              />
            </Link>
            <p className="m-0 max-w-[280px] text-sm leading-relaxed text-muted-foreground">
              {tr("footer.tagline")}
            </p>
          </div>

          <nav
            className="grid grid-cols-1 gap-8 sm:grid-cols-3 sm:gap-10"
            aria-label="Footer Navigation"
          >
            <div className="flex flex-col gap-3">
              <span className="mb-1 text-xs font-bold tracking-[0.08em] text-muted-foreground/80 uppercase">
                {tr("footer.explore")}
              </span>
              {exploreLinks.map(({ href, label }) => (
                <HashLink key={label} href={href} className={navLinkClass}>
                  {label}
                </HashLink>
              ))}
            </div>

            <div className="flex flex-col gap-3">
              <span className="mb-1 text-xs font-bold tracking-[0.08em] text-muted-foreground/80 uppercase">
                {tr("footer.legal")}
              </span>
              {legalLinks.map(({ href, label }) =>
                href.startsWith("/") ? (
                  <Link key={label} href={href} className={navLinkClass}>
                    {label}
                  </Link>
                ) : (
                  <a key={label} href={href} className={navLinkClass}>
                    {label}
                  </a>
                ),
              )}
            </div>

            <div className="flex flex-col gap-3">
              <span className="mb-1 text-xs font-bold tracking-[0.08em] text-muted-foreground/80 uppercase">
                {tr("footer.contact")}
              </span>

              {supportPhone ? (
                <a href={`tel:${telHref}`} className={contactLinkClass}>
                  <PhoneIcon />
                  {supportPhone}
                </a>
              ) : null}

              {supportEmail ? (
                <a
                  href={`mailto:${supportEmail}`}
                  className={contactLinkClass}
                >
                  <MailIcon />
                  {supportEmail}
                </a>
              ) : null}

              {whatsappUrl ? (
                <a
                  href={whatsappUrl}
                  className="mt-1.5 inline-flex w-fit items-center gap-2 rounded-full bg-primary px-[18px] py-2.5 text-[13.5px] font-bold text-white shadow-[0_4px_14px_rgba(37,211,102,0.3)] transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5  hover:shadow-[0_6px_20px_rgba(37,211,102,0.45)] active:translate-y-0"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <WhatsAppIcon className="text-white" />
                  <span>WhatsApp</span>
                </a>
              ) : null}
            </div>
          </nav>
        </div>

        <div className="flex flex-col-reverse flex-wrap items-start justify-between gap-5 border-t border-border pt-8 sm:flex-row sm:items-center">
          <p className="m-0 text-[13px] text-muted-foreground/80">
            &copy; {year} {companyName}. Tirana, Albania. {tr("footer.rights")}
          </p>

          <div className="flex gap-3">
            <a href="#" className={socialIconClass} aria-label="Instagram">
              <InstagramIcon />
            </a>
            <a href="#" className={socialIconClass} aria-label="Facebook">
              <FacebookIcon />
            </a>
            {whatsappUrl ? (
              <a
                href={whatsappUrl}
                className={socialIconClass}
                aria-label="WhatsApp"
                target="_blank"
                rel="noopener noreferrer"
              >
                <WhatsAppIcon />
              </a>
            ) : (
              <a href="#" className={socialIconClass} aria-label="WhatsApp">
                <WhatsAppIcon />
              </a>
            )}
          </div>
        </div>
      </MarketingContainer>
    </footer>
  )
}
