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
              className="rounded-2xl border border-border bg-brand-page"
            >
              <button
                type="button"
                aria-expanded={open}
                aria-controls={panelId}
                className="flex min-h-14 w-full touch-manipulation items-center justify-between gap-4 px-5 py-4 text-left sm:px-6 sm:py-5"
                onClick={() => setOpenId(open ? null : itemId)}
              >
                <span className="font-brand text-lg font-extrabold leading-snug text-brand">
                  {item.question}
                </span>
                <ChevronDownIcon
                  className={cn(
                    "size-5 shrink-0 text-muted-foreground transition-transform duration-300 ease-out sm:size-6",
                    open && "rotate-180",
                  )}
                  aria-hidden
                />
              </button>
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
                      "px-5 pb-5 text-base leading-relaxed text-muted-foreground whitespace-pre-line transition-opacity duration-300 ease-out md:px-6 md:pb-6",
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
