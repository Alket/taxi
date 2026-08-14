import Image from "next/image"
import Link from "next/link"

import {
  formatBlogDate,
  getPostAuthor,
  type BlogAuthor,
  type BlogPost,
} from "@/lib/blog"
import type { Locale } from "@/lib/i18n/locales"
import { localePath } from "@/lib/i18n/locales"

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
    <article className="overflow-hidden rounded-3xl border border-border bg-brand-surface shadow-sm">
      <Link href={href} className="group grid gap-0 lg:grid-cols-2">
        <div className="relative aspect-[16/10] w-full overflow-hidden bg-muted lg:aspect-auto lg:min-h-[22rem]">
          <Image
            src={post.heroImage.src}
            alt={post.heroImage.alt}
            width={post.heroImage.width}
            height={post.heroImage.height}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            sizes="(max-width: 1024px) 100vw, 50vw"
            priority
          />
        </div>
        <div className="flex flex-col justify-center gap-4 p-6 sm:p-8 lg:p-10">
          <div className="flex flex-wrap items-center gap-2 text-xs font-bold tracking-wide text-muted-foreground uppercase">
            <span className="rounded-full bg-[color-mix(in_srgb,var(--brand-accent)_14%,white)] px-3 py-1 text-brand-accent">
              {categoryLabel || post.category}
            </span>
            <span>{formatBlogDate(post.publishedAt)}</span>
            <span aria-hidden>·</span>
            <span>{post.readTimeMinutes} min read</span>
          </div>
          <h2 className="font-brand text-2xl font-extrabold tracking-tight text-brand md:text-3xl">
            {post.title}
          </h2>
          <p className="text-base leading-relaxed text-muted-foreground">
            {post.excerpt}
          </p>
          <p className="text-sm font-semibold text-brand">
            By {author.name} →
          </p>
        </div>
      </Link>
    </article>
  )
}
