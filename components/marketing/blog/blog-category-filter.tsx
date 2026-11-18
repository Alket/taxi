"use client"

import Link from "next/link"

import type { BlogFilterId } from "@/lib/blog"
import { useLocale, useT } from "@/lib/i18n/use-locale"
import { localePath } from "@/lib/i18n/locales"
import { cn } from "@/lib/utils"

export function BlogCategoryFilter({
  active,
  categories,
}: {
  active: BlogFilterId
  categories: { id: string; label: string }[]
}) {
  const locale = useLocale()
  const t = useT()
  const blogHref = localePath("/blog", locale)

  const filters: { id: BlogFilterId; label: string }[] = [
    { id: "all", label: t("blog.allGuides") },
    ...categories.map((c) => ({ id: c.id, label: c.label })),
  ]

  function hrefFor(filter: BlogFilterId) {
    if (filter === "all") return blogHref
    return `${blogHref}?category=${filter}`
  }

  return (
    <nav aria-label="Filter guides by category" className="w-full">
      <ul className="flex flex-wrap items-center gap-2.5">
        {filters.map((filter) => {
          const selected = active === filter.id
          return (
            <li key={filter.id}>
              <Link
                href={hrefFor(filter.id)}
                scroll={false}
                aria-current={selected ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-10 items-center justify-center rounded-full px-4 text-xs sm:text-sm transition-all duration-200 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:ring-offset-2",
                  selected
                    ? "bg-brand-accent font-extrabold text-white shadow-xs"
                    : "border border-border/80 bg-brand-surface font-bold text-brand/80 shadow-2xs hover:border-brand-accent/40 hover:bg-muted hover:text-brand",
                )}
              >
                {filter.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
