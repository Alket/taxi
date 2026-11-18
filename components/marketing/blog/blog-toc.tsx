"use client"

import { useEffect, useState } from "react"
import { ChevronDownIcon, ListIcon } from "lucide-react"

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
    <ol className="flex flex-col gap-1.5">
      {headings.map((heading) => {
        const active = activeId === heading.id
        return (
          <li key={heading.id}>
            <a
              href={`#${heading.id}`}
              className={cn(
                "group flex items-start gap-2.5 rounded-lg px-2.5 py-1.5 text-sm leading-snug transition-all duration-200",
                active
                  ? "bg-brand-accent/10 font-bold text-brand-accent"
                  : "font-medium text-brand/70 hover:bg-muted/70 hover:text-brand",
              )}
            >
              <span
                className={cn(
                  "mt-1.5 size-1.5 shrink-0 rounded-full transition-all duration-200",
                  active
                    ? "bg-brand-accent scale-125"
                    : "bg-transparent group-hover:bg-brand/40",
                )}
                aria-hidden
              />
              <span className="line-clamp-2">{heading.text}</span>
            </a>
          </li>
        )
      })}
    </ol>
  )

  return (
    <>
      <details className="group rounded-2xl border border-border/80 bg-brand-surface p-4 shadow-xs lg:hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between font-brand text-sm font-extrabold text-brand">
          <span className="flex items-center gap-2">
            <ListIcon className="size-4 text-brand-accent" />
            {t(locale, "blog.onThisPage")}
          </span>
          <ChevronDownIcon className="size-4 text-muted-foreground transition-transform duration-200 group-open:rotate-180" />
        </summary>
        <nav aria-label={t(locale, "blog.onThisPage")} className="mt-4 border-t border-border/50 pt-3">
          {list}
        </nav>
      </details>

      <nav
        aria-label={t(locale, "blog.onThisPage")}
        className="sticky top-28 hidden rounded-3xl border border-border/80 bg-brand-surface p-6 shadow-xs lg:block"
      >
        <p className="mb-4 flex items-center gap-2 text-xs font-black uppercase tracking-wider text-muted-foreground">
          <ListIcon className="size-3.5 text-brand-accent" />
          <span>{t(locale, "blog.onThisPage")}</span>
        </p>
        {list}
      </nav>
    </>
  )
}
