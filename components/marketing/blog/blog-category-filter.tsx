"use client"

import Link from "next/link"

import type { BlogFilterId } from "@/lib/blog"
import { useLocale } from "@/lib/i18n/use-locale"
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
  const blogHref = localePath("/blog", locale)

  const filters: { id: BlogFilterId; label: string }[] = [
    { id: "all", label: "All Guides" },
    ...categories.map((c) => ({ id: c.id, label: c.label })),
  ]

  function hrefFor(filter: BlogFilterId) {
    if (filter === "all") return blogHref
    return `${blogHref}?category=${filter}`
  }

  return (
    <nav aria-label="Filter guides by category" className="w-full">
      <ul className="flex flex-wrap gap-2">
        {filters.map((filter) => {
          const selected = active === filter.id
          return (
            <li key={filter.id}>
              <Link
                href={hrefFor(filter.id)}
                scroll={false}
                aria-current={selected ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-10 items-center rounded-full px-4 text-sm font-bold transition-colors",
                  selected
                    ? "bg-brand-accent text-white"
                    : "border border-border bg-brand-surface text-brand hover:bg-muted",
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
