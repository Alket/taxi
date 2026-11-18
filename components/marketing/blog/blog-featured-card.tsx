import Image from "next/image"
import Link from "next/link"
import { ArrowRightIcon, CalendarIcon, ClockIcon } from "lucide-react"

import {
  formatBlogDate,
  getPostAuthor,
  type BlogAuthor,
  type BlogPost,
} from "@/lib/blog"
import type { Locale } from "@/lib/i18n/locales"
import { localePath } from "@/lib/i18n/locales"
import { t } from "@/lib/i18n/t"

export function BlogFeaturedCard({
  post,
  locale,
  categoryLabel,
  author: authorProp,
}: {
  post: BlogPost
  locale: Locale
  categoryLabel?: string
  author?: BlogAuthor
}) {
  const author = authorProp ?? getPostAuthor(post)
  const href = localePath(`/blog/${post.slug}`, locale)

  return (
    <article className="overflow-hidden rounded-3xl border border-border/80 bg-brand-surface shadow-xs transition-all duration-300 hover:border-brand-accent/30 hover:shadow-md">
      <Link href={href} className="group grid gap-0 lg:grid-cols-2">
        <div className="relative aspect-[16/10] w-full overflow-hidden bg-muted lg:aspect-auto lg:min-h-[22rem]">
          <Image
            src={post.heroImage.src}
            alt={post.heroImage.alt}
            width={post.heroImage.width}
            height={post.heroImage.height}
            className="size-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
            sizes="(max-width: 1024px) 100vw, 50vw"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent lg:hidden" />
          <span className="absolute top-4 left-4 rounded-full border border-white/20 bg-brand-surface/95 px-3.5 py-1 text-xs font-black uppercase tracking-wider text-brand-accent shadow-xs backdrop-blur-sm lg:hidden">
            {categoryLabel || post.category}
          </span>
        </div>
        <div className="flex flex-col justify-center gap-4 p-6 sm:p-8 lg:p-10">
          <div className="hidden flex-wrap items-center gap-2.5 text-xs font-bold tracking-wide uppercase lg:flex">
            <span className="rounded-full border border-brand-accent/25 bg-brand-accent/10 px-3.5 py-1 text-xs font-black uppercase tracking-wider text-brand-accent">
              {categoryLabel || post.category}
            </span>
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <CalendarIcon className="size-3 text-muted-foreground/80" />
              <time dateTime={post.publishedAt}>
                {formatBlogDate(post.publishedAt, locale)}
              </time>
            </span>
            <span aria-hidden className="text-muted-foreground/60">·</span>
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <ClockIcon className="size-3 text-muted-foreground/80" />
              {t(locale, "blog.minRead", { minutes: post.readTimeMinutes })}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs font-bold tracking-wide uppercase text-muted-foreground lg:hidden">
            <span className="flex items-center gap-1">
              <CalendarIcon className="size-3 text-muted-foreground/80" />
              <time dateTime={post.publishedAt}>
                {formatBlogDate(post.publishedAt, locale)}
              </time>
            </span>
            <span aria-hidden className="text-muted-foreground/60">·</span>
            <span className="flex items-center gap-1">
              <ClockIcon className="size-3 text-muted-foreground/80" />
              {t(locale, "blog.minRead", { minutes: post.readTimeMinutes })}
            </span>
          </div>

          <h2 className="font-brand text-2xl font-black tracking-tight text-brand transition-colors duration-200 group-hover:text-brand-accent sm:text-3xl lg:text-3xl xl:text-4xl">
            {post.title}
          </h2>
          <p className="line-clamp-3 text-sm leading-relaxed text-brand/75 sm:line-clamp-4 sm:text-base">
            {post.excerpt}
          </p>

          <div className="mt-2 flex items-center justify-between border-t border-border/60 pt-4">
            <span className="text-xs font-bold text-brand/90 sm:text-sm">
              By {author.name}
            </span>
            <span className="inline-flex size-9 items-center justify-center rounded-full bg-brand-accent/10 text-brand-accent transition-all duration-200 group-hover:translate-x-1 group-hover:bg-brand-accent group-hover:text-white">
              <ArrowRightIcon className="size-4" aria-hidden />
            </span>
          </div>
        </div>
      </Link>
    </article>
  )
}
