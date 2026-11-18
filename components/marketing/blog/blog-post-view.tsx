import Image from "next/image"
import { CalendarIcon, ClockIcon } from "lucide-react"

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
  type BlogAuthor,
  type BlogPost,
} from "@/lib/blog"
import type { Destination } from "@/lib/destinations"
import type { Locale } from "@/lib/i18n/locales"
import { t } from "@/lib/i18n/t"

export function BlogPostView({
  post,
  locale,
  categoryLabel,
  author: authorProp,
  relatedDestinations = [],
}: {
  post: BlogPost
  locale: Locale
  categoryLabel?: string
  author?: BlogAuthor
  /** CMS destination cards (images/pricing) for the related-routes grid. */
  relatedDestinations?: Destination[]
}) {
  const author = authorProp ?? getPostAuthor(post)
  const headings = getPostH2Headings(post)
  const label = categoryLabel || post.category
  const breadcrumbs = buildPostBreadcrumbItems({
    locale,
    category: post.category,
    categoryLabel: label,
    title: post.title,
  })

  return (
    <main className="bg-brand-page pb-16 md:pb-24">
      {/* Editorial Hero Header */}
      <header className="relative isolate -mt-24 min-h-[max(68svh,30rem)] overflow-hidden md:min-h-[max(58svh,32rem)]">
        <Image
          src={post.heroImage.src}
          alt={post.heroImage.alt}
          fill
          priority
          fetchPriority="high"
          sizes="100vw"
          className="object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-brand-panel via-brand-panel/75 to-brand-panel/40" />
        <div className="absolute inset-0 bg-gradient-to-r from-brand-panel/65 via-transparent to-transparent" />

        <MarketingContainer className="relative z-10 flex min-h-[max(68svh,30rem)] flex-col justify-end pt-36 pb-10 text-white sm:pt-32 md:min-h-[max(58svh,32rem)] md:pb-14">
          <BlogBreadcrumb items={breadcrumbs} tone="onDark" />

          <div className="mt-5 flex flex-wrap items-center gap-2 text-xs font-bold tracking-wide uppercase text-white/80">
            <span className="rounded-full border border-white/20 bg-white/15 px-3 py-1 font-extrabold text-white backdrop-blur-sm">
              {label}
            </span>
            <span className="flex items-center gap-1.5 text-white/85">
              <CalendarIcon className="size-3 text-white/70" />
              <time dateTime={post.publishedAt}>
                {t(locale, "blog.published", {
                  date: formatBlogDate(post.publishedAt, locale),
                })}
              </time>
            </span>
            {post.updatedAt !== post.publishedAt ? (
              <>
                <span aria-hidden className="text-white/50">·</span>
                <time dateTime={post.updatedAt} className="text-white/75">
                  Updated {formatBlogDate(post.updatedAt, locale)}
                </time>
              </>
            ) : null}
            <span aria-hidden className="text-white/50">·</span>
            <span className="flex items-center gap-1.5 text-white/85">
              <ClockIcon className="size-3 text-white/70" />
              {t(locale, "blog.minRead", { minutes: post.readTimeMinutes })}
            </span>
            <span aria-hidden className="text-white/50">·</span>
            <span className="text-white/90">By {author.name}</span>
          </div>

          <h1 className="mt-4 max-w-4xl font-brand text-3xl font-black tracking-tight text-white sm:text-4xl md:text-5xl lg:text-[3.25rem] md:leading-[1.12]">
            {post.title}
          </h1>
        </MarketingContainer>
      </header>

      {/* Quick Takeaway Banner */}
      {post.quickTakeaway.trim() ? (
        <MarketingContainer className="mt-8 md:mt-10">
          <BlogQuickTakeaway text={post.quickTakeaway} locale={locale} />
        </MarketingContainer>
      ) : null}

      {/* Main Layout Grid */}
      <MarketingContainer className="mt-10 md:mt-14">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-12 xl:grid-cols-[minmax(0,1fr)_20rem]">
          <article className="min-w-0 max-w-full">
            <BlogArticleBody post={post} locale={locale} />
          </article>
          <aside className="lg:pt-1">
            <BlogToc headings={headings} />
          </aside>
        </div>

        {/* Postscript Stack */}
        <div className="mt-12 space-y-12 md:mt-16 md:space-y-16">
          <BlogAuthorBio author={author} locale={locale} />
          <BlogRelatedRoutes
            destinations={relatedDestinations}
            locale={locale}
          />
          <BlogFaq items={post.faq} />
        </div>
      </MarketingContainer>
    </main>
  )
}
