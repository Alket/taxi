"use client"

import { ArrowRight, CheckIcon, XIcon } from "lucide-react"

import {
  MarketingContainer,
  MARKETING_SECTION_TITLE,
} from "@/components/marketing/marketing-container"
import { useLocale } from "@/lib/i18n/use-locale"
import { t } from "@/lib/i18n/t"
import type { HomeCompareColumn } from "@/lib/page-content-shared"
import { scrollToHashId } from "@/lib/smooth-hash-scroll"
import { cn } from "@/lib/utils"

type CompareCopy = {
  eyebrow: string
  heading: string
  subtitle: string
  columns: HomeCompareColumn[]
}

function CompareCard({ column }: { column: HomeCompareColumn }) {
  const locale = useLocale()
  const isPremium = column.tone === "positive"

  return (
    <article
      className={cn(
        "relative flex flex-col justify-between rounded-3xl p-7 transition-all duration-300 sm:p-8",
        isPremium
          ? "z-[1] bg-brand-accent text-white shadow-lg hover:-translate-y-1 hover:shadow-xl md:scale-[1.03]"
          : "border border-border/80 bg-brand-surface text-brand/75 shadow-xs hover:-translate-y-0.5 hover:border-border hover:shadow-md",
      )}
    >
      <div>
        {isPremium && column.badge ? (
          <span className="absolute -top-3.5 left-7 rounded-full border border-white/20 bg-brand px-3.5 py-1 text-xs font-bold tracking-wider text-white uppercase shadow-md">
            {column.badge}
          </span>
        ) : null}

        <h3
          className={cn(
            "m-0 border-b pb-4 font-brand font-extrabold",
            isPremium
              ? "border-white/20 text-xl text-white md:text-2xl"
              : "border-border/80 text-lg text-brand md:text-xl",
          )}
        >
          <span>{column.title}</span>
          {column.subtitle ? (
            <span
              className={cn(
                "mt-1 block text-sm font-normal",
                isPremium ? "text-white/80" : "text-muted-foreground",
              )}
            >
              {column.subtitle}
            </span>
          ) : null}
        </h3>

        <ul className="mt-6 flex list-none flex-col gap-3.5 p-0 md:gap-4">
          {column.items.map((item) => (
            <li
              key={`${item.label}-${item.detail}`}
              className="flex items-start gap-3 text-sm leading-snug md:text-[0.95rem]"
            >
              <span
                className={cn(
                  "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full",
                  isPremium
                    ? "bg-white text-brand-accent shadow-xs"
                    : "bg-destructive/10 text-destructive",
                )}
              >
                {isPremium ? (
                  <CheckIcon className="size-3.5" strokeWidth={2.5} aria-hidden />
                ) : (
                  <XIcon className="size-3.5" strokeWidth={2.5} aria-hidden />
                )}
              </span>
              <span className={isPremium ? "text-white/95" : undefined}>
                {item.label ? (
                  <>
                    <strong
                      className={cn(
                        "font-bold",
                        isPremium ? "text-white" : "text-brand",
                      )}
                    >
                      {item.label}:
                    </strong>{" "}
                    {item.detail}
                  </>
                ) : (
                  item.detail
                )}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {isPremium ? (
        <div className="mt-8 border-t border-white/20 pt-5">
          <button
            type="button"
            onClick={() => scrollToHashId("book")}
            className="group flex w-full items-center justify-center gap-2 rounded-full bg-white py-3.5 text-sm font-extrabold text-brand-accent shadow-sm transition-all duration-200 hover:bg-white/95 hover:shadow-md active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand-accent"
          >
            <span>{t(locale, "cta.bookTransfer")}</span>
            <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-1" aria-hidden />
          </button>
        </div>
      ) : null}
    </article>
  )
}

export function ComparisonSection({ copy }: { copy: CompareCopy }) {
  if (!copy.heading) return null

  return (
    <section
      id="comparison"
      aria-labelledby="compare-heading"
      className="border-b border-border/60 bg-brand-page py-12 font-brand md:py-20 lg:py-24"
    >
      <MarketingContainer>
        <div className="mx-auto mb-10 max-w-2xl text-left md:mb-14 md:text-center">
          {copy.eyebrow ? (
            <span className="mb-2 block text-xs font-extrabold tracking-[0.14em] text-brand-accent uppercase">
              {copy.eyebrow}
            </span>
          ) : null}
          <h2 id="compare-heading" className={MARKETING_SECTION_TITLE}>
            {copy.heading}
          </h2>
          {copy.subtitle ? (
            <p className="mt-3.5 max-w-xl text-base leading-relaxed text-brand/80 dark:text-muted-foreground md:mx-auto md:text-lg">
              {copy.subtitle}
            </p>
          ) : null}
        </div>

        <div className="grid grid-cols-1 items-stretch gap-6 md:grid-cols-3 lg:gap-7">
          {copy.columns.map((column) => (
            <CompareCard key={column.title} column={column} />
          ))}
        </div>
      </MarketingContainer>
    </section>
  )
}
