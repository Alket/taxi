import Link from "next/link"

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
          "flex flex-wrap items-center gap-1.5 text-sm",
          onDark ? "text-white/80" : "text-muted-foreground",
        )}
      >
        {items.map((item, index) => {
          const last = index === items.length - 1
          return (
            <li key={`${item.name}-${index}`} className="flex items-center gap-1.5">
              {index > 0 ? (
                <span
                  aria-hidden
                  className={onDark ? "text-white/50" : "text-muted-foreground/70"}
                >
                  /
                </span>
              ) : null}
              {item.href && !last ? (
                <Link
                  href={item.href}
                  className={cn(
                    "font-semibold transition-colors",
                    onDark ? "hover:text-white" : "hover:text-brand",
                  )}
                >
                  {item.name}
                </Link>
              ) : (
                <span
                  className={cn(
                    last && "line-clamp-1 font-semibold",
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
  title,
}: {
  locale: Locale
  category: BlogCategoryId
  title: string
}): BlogBreadcrumbItem[] {
  return [
    { name: "Home", href: localePath("/", locale) },
    { name: "Blog", href: localePath("/blog", locale) },
    {
      name: BLOG_CATEGORY_LABELS[category],
      href: localePath(`/blog?category=${category}`, locale),
    },
    { name: title },
  ]
}
