"use client"

import { useEffect, useState } from "react"

import { useLocale } from "@/lib/i18n/use-locale"
import { t } from "@/lib/i18n/t"
import { cn } from "@/lib/utils"

export function BlogToc({
  headings,
}: {
  headings: { id: string; text: string }[]
}) {
  const locale = useLocale()
  const [activeId, setActiveId] = useState<string>(headings[0]?.id ?? "")

  useEffect(() => {
    if (headings.length === 0) return

    const elements = headings
      .map((h) => document.getElementById(h.id))
      .filter((el): el is HTMLElement => Boolean(el))

    if (elements.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort(
            (a, b) =>
              (a.target as HTMLElement).offsetTop -
              (b.target as HTMLElement).offsetTop,
          )
        if (visible[0]?.target.id) {
          setActiveId(visible[0].target.id)
        }
      },
      { rootMargin: "-20% 0px -65% 0px", threshold: [0, 1] },
    )

    for (const el of elements) observer.observe(el)
    return () => observer.disconnect()
  }, [headings])

  if (headings.length === 0) return null

  const list = (
    <ol className="flex flex-col gap-2">
      {headings.map((heading) => {
        const active = activeId === heading.id
        return (
          <li key={heading.id}>
            <a
              href={`#${heading.id}`}
              className={cn(
                "block text-sm leading-snug transition-colors",
                active
                  ? "font-bold text-brand-accent"
                  : "font-medium text-muted-foreground hover:text-brand",
              )}
            >
              {heading.text}
            </a>
          </li>
        )
      })}
    </ol>
  )

  return (
    <>
      <details className="rounded-2xl border border-border bg-brand-surface p-4 lg:hidden">
        <summary className="cursor-pointer list-none font-brand text-sm font-extrabold text-brand">
          {t(locale, "blog.onThisPage")}
        </summary>
        <nav aria-label={t(locale, "blog.onThisPage")} className="mt-3">
          {list}
        </nav>
      </details>

      <nav
        aria-label={t(locale, "blog.onThisPage")}
        className="sticky top-28 hidden rounded-2xl border border-border bg-brand-surface p-5 lg:block"
      >
        <p className="mb-3 text-xs font-bold tracking-[0.14em] text-muted-foreground uppercase">
          {t(locale, "blog.onThisPage")}
        </p>
        {list}
      </nav>
    </>
  )
}
