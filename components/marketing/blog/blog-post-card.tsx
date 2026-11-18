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

export function BlogPostCard({
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
    <article className="group flex h-full flex-col overflow-hidden rounded-3xl border border-border/80 bg-brand-surface shadow-2xs transition-all duration-300 hover:-translate-y-1 hover:border-brand-accent/30 hover:shadow-md">
      <Link href={href} className="flex h-full flex-col">
        <div className="relative aspect-[16/10] w-full overflow-hidden bg-muted">
          <Image
            src={post.heroImage.src}
            alt={post.heroImage.alt}
            width={post.heroImage.width}
            height={post.heroImage.height}
            className="size-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
            sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
          />
          <span className="absolute top-3.5 left-3.5 rounded-full border border-white/20 bg-brand-surface/95 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-brand-accent shadow-xs backdrop-blur-sm">
            {categoryLabel || post.category}
          </span>
        </div>
        <div className="flex flex-1 flex-col gap-3 p-5 sm:p-6">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
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

          <h2 className="font-brand text-lg font-black leading-snug tracking-tight text-brand transition-colors duration-200 group-hover:text-brand-accent sm:text-xl">
            {post.title}
          </h2>
          <p className="line-clamp-3 flex-1 text-sm leading-relaxed text-brand/75">
            {post.excerpt}
          </p>

          <div className="mt-auto flex items-center justify-between border-t border-border/60 pt-3 text-xs font-semibold text-muted-foreground">
            <span className="font-bold text-brand/80">{author.name}</span>
            <span className="inline-flex size-7 items-center justify-center rounded-full bg-brand-accent/10 text-brand-accent transition-all duration-200 group-hover:translate-x-0.5 group-hover:bg-brand-accent group-hover:text-white">
              <ArrowRightIcon className="size-3.5" aria-hidden />
            </span>
          </div>
        </div>
      </Link>
    </article>
  )
}
