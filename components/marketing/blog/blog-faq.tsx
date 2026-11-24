"use client"

import { useId, useState } from "react"
import { ChevronDownIcon } from "lucide-react"

import type { BlogFaqItem } from "@/lib/blog"
import { MARKETING_SECTION_TITLE } from "@/components/marketing/marketing-container"
import { useT } from "@/lib/i18n/use-locale"
import { cn } from "@/lib/utils"

export function BlogFaq({
  items,
  heading,
}: {
  items: BlogFaqItem[]
  /** Override default translated “FAQ” heading (e.g. transfer route pages). */
  heading?: string
}) {
  const t = useT()
  const reactId = useId()
  const [openId, setOpenId] = useState<string | null>(null)

  if (items.length === 0) return null

  return (
    <section aria-label="FAQ" className="w-full">
      <h2 className={MARKETING_SECTION_TITLE}>{heading ?? t("blog.faq")}</h2>
      <div className="mt-6 flex flex-col gap-3">
        {items.map((item, index) => {
          const itemId = `${reactId}-${index}`
          const open = openId === itemId
          const panelId = `${itemId}-panel`

          return (
            <div
              key={itemId}
              className={cn(
                "rounded-2xl border transition-all duration-200",
                open
                  ? "border-brand-accent/40 bg-brand-surface shadow-xs ring-1 ring-brand-accent/20"
                  : "border-border/80 bg-brand-surface shadow-2xs hover:border-brand-accent/30",
              )}
            >
              <h3 className="m-0">
                <button
                  type="button"
                  aria-expanded={open}
                  aria-controls={panelId}
                  className="flex min-h-14 w-full touch-manipulation items-center justify-between gap-4 px-5 py-4 text-left sm:px-6 sm:py-5"
                  onClick={() => setOpenId(open ? null : itemId)}
                >
                  <span
                    className={cn(
                      "font-brand text-base font-bold leading-snug transition-colors sm:text-lg",
                      open ? "text-brand-accent" : "text-brand",
                    )}
                  >
                    {item.question}
                  </span>
                  <span
                    className={cn(
                      "flex size-8 shrink-0 items-center justify-center rounded-full transition-colors",
                      open
                        ? "bg-brand-accent/10 text-brand-accent"
                        : "bg-brand-page text-muted-foreground",
                    )}
                  >
                    <ChevronDownIcon
                      className={cn(
                        "size-4 transition-transform duration-300 ease-out",
                        open && "rotate-180",
                      )}
                      aria-hidden
                    />
                  </span>
                </button>
              </h3>
              <div
                id={panelId}
                role="region"
                aria-hidden={!open}
                className={cn(
                  "grid transition-[grid-template-rows] duration-300 ease-out",
                  open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
                )}
              >
                <div className="min-h-0 overflow-hidden">
                  <p
                    className={cn(
                      "px-5 pb-5 text-sm sm:text-base leading-relaxed text-brand/75 whitespace-pre-line transition-opacity duration-300 ease-out md:px-6 md:pb-6",
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
    </section>
  )
}
