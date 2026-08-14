import Image from "next/image"

import { BlogArticleBody } from "@/components/marketing/blog/blog-article-body"
import { BlogAuthorBio } from "@/components/marketing/blog/blog-author-bio"
import {
  BlogBreadcrumb,
  buildPostBreadcrumbItems,
} from "@/components/marketing/blog/blog-breadcrumb"
import { BlogFaq } from "@/components/marketing/blog/blog-faq"
import { BlogQuickTakeaway } from "@/components/marketing/blog/blog-quick-takeaway"
import { BlogRelatedRoutes } from "@/components/marketing/blog/blog-related-routes"
import { BlogToc } from "@/components/marketing/blog/blog-toc"
import { MarketingContainer } from "@/components/marketing/marketing-container"
import {
  formatBlogDate,
  getPostAuthor,
  getPostH2Headings,
  getRelatedDestinations,
  type BlogAuthor,
  type BlogPost,
} from "@/lib/blog"
import type { Locale } from "@/lib/i18n/locales"

export function BlogPostView({
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
  const headings = getPostH2Headings(post)
  const related = getRelatedDestinations(post)
  const label = categoryLabel || post.category
  const breadcrumbs = buildPostBreadcrumbItems({
    locale,
    category: post.category,
    categoryLabel: label,
    title: post.title,
  })

  return (
    <main className="bg-brand-page pb-16 md:pb-24">
      <header className="relative isolate -mt-24 min-h-[min(62svh,34rem)] overflow-hidden md:min-h-[min(58svh,38rem)]">
        <Image
          src={post.heroImage.src}
          alt={post.heroImage.alt}
          fill
          priority
          fetchPriority="high"
          sizes="100vw"
          className="object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-brand-panel via-brand-panel/55 to-brand-panel/25" />
        <div className="absolute inset-0 bg-gradient-to-r from-brand-panel/55 via-transparent to-transparent" />

        <MarketingContainer className="relative z-10 flex min-h-[min(62svh,34rem)] flex-col justify-end pb-10 pt-28 text-white md:min-h-[min(58svh,38rem)] md:pb-14 md:pt-32">
          <BlogBreadcrumb items={breadcrumbs} tone="onDark" />

          <div className="mt-5 flex flex-wrap items-center gap-2 text-xs font-bold tracking-wide text-white/75 uppercase">
            <span className="rounded-full bg-white/15 px-3 py-1 text-white backdrop-blur-sm">
              {label}
            </span>
            <time dateTime={post.publishedAt}>
              Published {formatBlogDate(post.publishedAt)}
            </time>
            {post.updatedAt !== post.publishedAt ? (
              <>
                <span aria-hidden>·</span>
                <time dateTime={post.updatedAt}>
                  Updated {formatBlogDate(post.updatedAt)}
                </time>
              </>
            ) : null}
            <span aria-hidden>·</span>
            <span>{post.readTimeMinutes} min read</span>
            <span aria-hidden>·</span>
            <span>{author.name}</span>
          </div>

          <h1 className="mt-4 max-w-4xl font-brand text-3xl font-extrabold tracking-tight text-white sm:text-4xl md:text-5xl md:leading-[1.15]">
            {post.title}
          </h1>
        </MarketingContainer>
      </header>

      <MarketingContainer className="mt-8 md:mt-10">
        <BlogQuickTakeaway text={post.quickTakeaway} />
      </MarketingContainer>

      <MarketingContainer className="mt-10 md:mt-14">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_16rem] lg:gap-12">
          <article>
            <BlogArticleBody post={post} locale={locale} />
          </article>
          <aside className="lg:pt-1">
            <BlogToc headings={headings} />
          </aside>
        </div>

        <div className="mt-12 space-y-12 md:mt-16 md:space-y-16">
          <BlogAuthorBio author={author} />
          <BlogRelatedRoutes destinations={related} locale={locale} />
          <BlogFaq items={post.faq} />
        </div>
      </MarketingContainer>
    </main>
  )
}
