import Link from "next/link"
import { ChevronRightIcon } from "lucide-react"

import {
  BLOG_CATEGORY_LABELS,
  type BlogCategoryId,
} from "@/lib/blog"
import type { Locale } from "@/lib/i18n/locales"
import { localePath } from "@/lib/i18n/locales"
import { cn } from "@/lib/utils"

export type BlogBreadcrumbItem = {
  name: string
  href?: string
}

export function BlogBreadcrumb({
  items,
  className,
  tone = "default",
}: {
  items: BlogBreadcrumbItem[]
  className?: string
  tone?: "default" | "onDark"
}) {
  const onDark = tone === "onDark"

  return (
    <nav aria-label="Breadcrumb" className={cn("w-full", className)}>
      <ol
        className={cn(
          "flex flex-wrap items-center gap-1.5 text-xs sm:text-sm",
          onDark ? "text-white/80" : "text-muted-foreground",
        )}
      >
        {items.map((item, index) => {
          const last = index === items.length - 1
          return (
            <li key={`${item.name}-${index}`} className="flex items-center gap-1.5">
              {index > 0 ? (
                <ChevronRightIcon
                  aria-hidden
                  className={cn(
                    "size-3 shrink-0",
                    onDark ? "text-white/50" : "text-muted-foreground/60",
                  )}
                />
              ) : null}
              {item.href && !last ? (
                <Link
                  href={item.href}
                  className={cn(
                    "font-bold transition-colors",
                    onDark ? "hover:text-white" : "hover:text-brand",
                  )}
                >
                  {item.name}
                </Link>
              ) : (
                <span
                  className={cn(
                    last && "line-clamp-1 font-bold",
                    last && (onDark ? "text-white" : "text-brand"),
                  )}
                  aria-current={last ? "page" : undefined}
                >
                  {item.name}
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

export function buildPostBreadcrumbItems({
  locale,
  category,
  categoryLabel,
  title,
}: {
  locale: Locale
  category: BlogCategoryId
  categoryLabel?: string
  title: string
}): BlogBreadcrumbItem[] {
  return [
    { name: "Home", href: localePath("/", locale) },
    { name: "Blog", href: localePath("/blog", locale) },
    {
      name: categoryLabel || BLOG_CATEGORY_LABELS[category] || category,
      href: localePath(`/blog?category=${category}`, locale),
    },
    { name: title },
  ]
}
