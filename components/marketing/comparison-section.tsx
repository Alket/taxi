import { CheckIcon, XIcon } from "lucide-react"

import {
  MarketingContainer,
  MARKETING_SECTION_TITLE,
} from "@/components/marketing/marketing-container"
import type { HomeCompareColumn } from "@/lib/page-content-shared"
import { cn } from "@/lib/utils"

type CompareCopy = {
  eyebrow: string
  heading: string
  subtitle: string
  columns: HomeCompareColumn[]
}

function CompareCard({ column }: { column: HomeCompareColumn }) {
  const isPremium = column.tone === "positive"

  return (
    <article
      className={cn(
        "relative rounded-3xl px-7 py-9",
        isPremium
          ? "z-[1] bg-brand-accent px-8 py-10 text-white shadow-[0_20px_40px_-10px_color-mix(in_srgb,var(--brand-accent)_40%,transparent)] md:scale-[1.03]"
          : "border border-border bg-brand-surface text-muted-foreground shadow-sm",
      )}
    >
      {isPremium && column.badge ? (
        <span className="absolute -top-4 left-7 rounded-full bg-brand px-3.5 py-1.5 text-[11px] font-extrabold tracking-wide text-white uppercase shadow-md">
          {column.badge}
        </span>
      ) : null}

      <h3
        className={cn(
          "m-0 border-b pb-4 font-brand font-extrabold",
          isPremium
            ? "border-white/20 text-xl text-white md:text-2xl"
            : "border-border text-lg text-brand md:text-xl",
        )}
      >
        {column.title}
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

      <ul className="mt-7 flex list-none flex-col gap-4 p-0 md:gap-[1.125rem]">
        {column.items.map((item) => (
          <li
            key={`${item.label}-${item.detail}`}
            className="flex items-start gap-3 text-sm leading-snug md:text-[0.95rem]"
          >
            <span
              className={cn(
                "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full",
                isPremium
                  ? "bg-white text-brand-accent"
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
    </article>
  )
}

export function ComparisonSection({ copy }: { copy: CompareCopy }) {
  if (!copy.heading) return null

  return (
    <section
      id="comparison"
      aria-labelledby="compare-heading"
      className="bg-transparent py-10 font-brand md:py-24"
    >
      <MarketingContainer>
        <div className="mx-auto mb-10 max-w-2xl text-left md:mb-14 md:text-center">
          {copy.eyebrow ? (
            <p className="mb-3 text-xs font-extrabold tracking-widest text-brand-accent uppercase">
              {copy.eyebrow}
            </p>
          ) : null}
          <h2 id="compare-heading" className={MARKETING_SECTION_TITLE}>
            {copy.heading}
          </h2>
          {copy.subtitle ? (
            <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground md:mx-auto">
              {copy.subtitle}
            </p>
          ) : null}
        </div>

        <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-[1fr_1.15fr_1fr] lg:gap-6">
          {copy.columns.map((column) => (
            <CompareCard key={column.title} column={column} />
          ))}
        </div>
      </MarketingContainer>
    </section>
  )
}
