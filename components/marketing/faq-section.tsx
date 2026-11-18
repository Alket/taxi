"use client"

import { useId, useState } from "react"
import { ArrowRightIcon, ChevronDownIcon, HelpCircleIcon } from "lucide-react"

import {
  MarketingContainer,
  MARKETING_SECTION_TITLE,
} from "@/components/marketing/marketing-container"
import { useLocale } from "@/lib/i18n/use-locale"
import { t } from "@/lib/i18n/t"
import type { PageSection } from "@/lib/page-content-shared"
import { scrollToHashId } from "@/lib/smooth-hash-scroll"
import { cn } from "@/lib/utils"

export function FaqSection({
  items,
  heading = "Frequently asked questions",
}: {
  items: PageSection[]
  heading?: string
}) {
  const locale = useLocale()
  const reactId = useId()
  const [openId, setOpenId] = useState<string | null>(null)

  if (items.length === 0) return null

  return (
    <section
      id="faq"
      className="scroll-mt-28 border-t border-border/60 bg-white py-12 font-brand md:py-20 lg:py-24"
    >
      <MarketingContainer>
        <div className="mb-8 max-w-2xl md:mb-12">
          <span className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-brand-accent/20 bg-brand-accent/10 px-3.5 py-1 text-xs font-bold tracking-wide text-brand-accent uppercase">
            <HelpCircleIcon className="size-3.5 text-brand-accent" aria-hidden />
            <span>{t(locale, "nav.faq")}</span>
          </span>
          <h2 className={MARKETING_SECTION_TITLE}>{heading}</h2>
        </div>

        <div className="flex flex-col gap-3.5 sm:gap-4">
          {items.map((item, index) => {
            const itemId = item.id || `${reactId}-${index}`
            const open = openId === itemId
            const triggerId = `${itemId}-trigger`
            const panelId = `${itemId}-panel`

            return (
              <div
                key={itemId}
                className={cn(
                  "overflow-hidden rounded-2xl border transition-all duration-200",
                  open
                    ? "border-brand-accent/35 bg-brand-surface shadow-xs"
                    : "border-border/80 bg-brand-page hover:border-border hover:bg-brand-page/80",
                )}
              >
                <h3>
                  <button
                    id={triggerId}
                    type="button"
                    aria-expanded={open}
                    aria-controls={panelId}
                    className="group flex min-h-14 w-full touch-manipulation items-center justify-between gap-4 px-5 py-4 text-left transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:ring-offset-2 sm:px-6 sm:py-5"
                    onClick={() => setOpenId(open ? null : itemId)}
                  >
                    <span
                      className={cn(
                        "font-brand text-base font-extrabold leading-snug transition-colors duration-200 sm:text-lg",
                        open
                          ? "text-brand-accent"
                          : "text-brand group-hover:text-brand-accent",
                      )}
                    >
                      {item.question}
                    </span>
                    <span
                      className={cn(
                        "flex size-8 shrink-0 items-center justify-center rounded-full transition-all duration-300 sm:size-9",
                        open
                          ? "rotate-180 bg-brand-accent text-white shadow-xs"
                          : "border border-border/80 bg-brand-surface text-muted-foreground group-hover:border-brand-accent/40 group-hover:text-brand-accent",
                      )}
                    >
                      <ChevronDownIcon
                        className="size-4 sm:size-4.5"
                        strokeWidth={2.2}
                        aria-hidden
                      />
                    </span>
                  </button>
                </h3>
                <div
                  id={panelId}
                  role="region"
                  aria-labelledby={triggerId}
                  aria-hidden={!open}
                  className={cn(
                    "grid transition-[grid-template-rows] duration-300 ease-out",
                    open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
                  )}
                >
                  <div className="min-h-0 overflow-hidden">
                    <p
                      className={cn(
                        "px-5 pb-5 text-sm leading-relaxed text-brand/80 dark:text-muted-foreground whitespace-pre-line transition-opacity duration-300 ease-out sm:text-base md:px-6 md:pb-6",
                        open ? "opacity-100" : "opacity-0",
                      )}
                    >
                      {item.answer}
                    </p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <div className="mt-10 rounded-3xl border border-dashed border-border/80 bg-brand-page/60 p-6 text-center sm:mt-14 sm:p-8">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-accent/20 bg-brand-accent/10 px-3 py-0.5 text-xs font-extrabold tracking-wider text-brand-accent uppercase">
            {t(locale, "destinations.readyEyebrow")}
          </span>
          <p className="mt-2 font-brand text-lg font-extrabold text-brand sm:text-xl">
            {t(locale, "destinations.readyTitle")}
          </p>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-brand/75 dark:text-muted-foreground">
            {t(locale, "destinations.readyText")}
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => scrollToHashId("book")}
              className="group inline-flex min-h-11 items-center gap-2 rounded-full bg-brand-accent px-7 py-2.5 text-sm font-extrabold text-white shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:bg-brand-accent-hover hover:brightness-95 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:ring-offset-2"
            >
              <span>{t(locale, "cta.bookTransfer")}</span>
              <ArrowRightIcon
                className="size-4 transition-transform duration-200 group-hover:translate-x-1"
                aria-hidden
              />
            </button>
          </div>
        </div>
      </MarketingContainer>
    </section>
  )
}
