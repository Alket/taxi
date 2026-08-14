import Image from "next/image"
import { Suspense } from "react"

import { BlogCategoryFilter } from "@/components/marketing/blog/blog-category-filter"
import { BlogFareCta } from "@/components/marketing/blog/blog-fare-cta"
import { BlogFeaturedCard } from "@/components/marketing/blog/blog-featured-card"
import { BlogPostCard } from "@/components/marketing/blog/blog-post-card"
import {
  MarketingContainer,
  MARKETING_SECTION_TITLE,
} from "@/components/marketing/marketing-container"
import type { BlogFilterId, BlogPost } from "@/lib/blog"
import type { BlogArchiveCopy } from "@/lib/page-content-shared"
import type { BlogCategoryRecord } from "@/lib/blog/catalog"
import type { Locale } from "@/lib/i18n/locales"
import { cn } from "@/lib/utils"

const BLOG_HERO_FALLBACK =
  "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&q=80&w=2000"

export function BlogArchive({
  locale,
  filter,
  featured,
  rest,
  copy,
  categories,
  categoryLabels,
}: {
  locale: Locale
  filter: BlogFilterId
  featured: BlogPost | null
  rest: BlogPost[]
  copy: BlogArchiveCopy
  categories: BlogCategoryRecord[]
  categoryLabels: Record<string, string>
}) {
  const heroImage = featured?.heroImage.src || BLOG_HERO_FALLBACK
  const heroAlt =
    featured?.heroImage.alt ||
    copy.hero.heading ||
    "Albania airport transport and travel guides"

  return (
    <main className="bg-brand-page pb-16 md:pb-24">
      <header className="relative isolate -mt-24 h-[min(62svh,34rem)] min-h-[24rem] overflow-hidden md:h-[min(48svh,32rem)] md:min-h-0">
        <Image
          src={heroImage}
          alt={heroAlt}
          fill
          priority
          fetchPriority="high"
          sizes="100vw"
          className="object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-brand-panel via-brand-panel/55 to-brand-panel/25" />
        <div className="absolute inset-0 bg-gradient-to-r from-brand-panel/55 via-transparent to-transparent" />

        <MarketingContainer className="relative z-10 flex h-full flex-col justify-end pb-10 pt-28 text-white md:pb-14 md:pt-32">
          <p className="text-xs font-bold tracking-[0.14em] text-white/70 uppercase">
            {copy.hero.eyebrow}
          </p>
          <h1 className="mt-3 max-w-3xl font-brand text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl">
            {copy.hero.heading}
          </h1>
          <p className="mt-3 max-w-xl text-base leading-relaxed text-white/85 md:text-lg">
            {copy.hero.text}
          </p>
        </MarketingContainer>
      </header>

      <MarketingContainer className="mt-8 md:mt-10">
        <BlogFareCta locale={locale} copy={copy.cta} />
      </MarketingContainer>

      <section
        aria-label="Featured and filtered guides"
        className="mt-10 md:mt-14"
      >
        <MarketingContainer>
          <Suspense
            fallback={
              <div className="h-10 w-full max-w-xl animate-pulse rounded-full bg-muted" />
            }
          >
            <BlogCategoryFilter active={filter} categories={categories} />
          </Suspense>

          <div className="mt-8">
            {featured ? (
              <BlogFeaturedCard
                post={featured}
                locale={locale}
                categoryLabel={
                  categoryLabels[featured.category] || featured.category
                }
              />
            ) : (
              <p className="rounded-2xl border border-border bg-brand-surface px-5 py-8 text-muted-foreground">
                No guides published yet. Check back soon.
              </p>
            )}
          </div>
        </MarketingContainer>
      </section>

      <section aria-label="All guide articles" className="mt-10 md:mt-14">
        <MarketingContainer>
          <h2 className={cn(MARKETING_SECTION_TITLE, "sr-only")}>
            Guide articles
          </h2>
          {rest.length === 0 ? (
            <p className="rounded-2xl border border-border bg-brand-surface px-5 py-8 text-muted-foreground">
              {featured
                ? "No more guides in this category yet. Check back soon."
                : "No guides in this category yet. Check back soon."}
            </p>
          ) : (
            <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {rest.map((post) => (
                <li key={post.slug}>
                  <BlogPostCard
                    post={post}
                    locale={locale}
                    categoryLabel={
                      categoryLabels[post.category] || post.category
                    }
                  />
                </li>
              ))}
            </ul>
          )}
        </MarketingContainer>
      </section>
    </main>
  )
}
