"use client"

import Link from "next/link"

import {
  BLOG_CATEGORY_LABELS,
  type BlogFilterId,
} from "@/lib/blog"
import { useLocale } from "@/lib/i18n/use-locale"
import { localePath } from "@/lib/i18n/locales"
import { cn } from "@/lib/utils"

const FILTERS: BlogFilterId[] = [
  "all",
  "airport-transport",
  "destinations-routes",
  "local-tips",
]

export function BlogCategoryFilter({
  active,
}: {
  active: BlogFilterId
}) {
  const locale = useLocale()
  const blogHref = localePath("/blog", locale)

  function hrefFor(filter: BlogFilterId) {
    if (filter === "all") return blogHref
    return `${blogHref}?category=${filter}`
  }

  return (
    <nav aria-label="Filter guides by category" className="w-full">
      <ul className="flex flex-wrap gap-2">
        {FILTERS.map((filter) => {
          const selected = active === filter
          return (
            <li key={filter}>
              <Link
                href={hrefFor(filter)}
                scroll={false}
                aria-current={selected ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-10 items-center rounded-full px-4 text-sm font-bold transition-colors",
                  selected
                    ? "bg-brand-accent text-white"
                    : "border border-border bg-brand-surface text-brand hover:bg-muted",
                )}
              >
                {BLOG_CATEGORY_LABELS[filter]}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
