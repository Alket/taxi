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
    <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-brand-surface shadow-sm transition-shadow hover:shadow-md">
      <Link href={href} className="group flex h-full flex-col">
        <div className="relative aspect-[16/10] w-full overflow-hidden bg-muted">
          <Image
            src={post.heroImage.src}
            alt={post.heroImage.alt}
            width={post.heroImage.width}
            height={post.heroImage.height}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
          />
          <span className="absolute top-3 left-3 rounded-full bg-brand-surface/95 px-3 py-1 text-[11px] font-bold tracking-wide text-brand-accent uppercase shadow-sm">
            {categoryLabel || post.category}
          </span>
        </div>
        <div className="flex flex-1 flex-col gap-3 p-5">
          <h2 className="font-brand text-xl font-extrabold leading-snug tracking-tight text-brand">
            {post.title}
          </h2>
          <p className="line-clamp-3 flex-1 text-sm leading-relaxed text-muted-foreground">
            {post.excerpt}
          </p>
          <div className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-border/70 pt-3 text-xs font-semibold text-muted-foreground">
            <span>{author.name}</span>
            <span aria-hidden>·</span>
            <time dateTime={post.publishedAt}>
              {formatBlogDate(post.publishedAt)}
            </time>
            <span aria-hidden>·</span>
            <span>{post.readTimeMinutes} min read</span>
          </div>
        </div>
      </Link>
    </article>
  )
}
