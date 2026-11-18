import Image from "next/image"
import { Suspense } from "react"
import { BookOpenIcon } from "lucide-react"

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
      <header className="relative isolate -mt-24 h-[min(62svh,34rem)] min-h-[22rem] overflow-hidden md:h-[min(48svh,32rem)] md:min-h-[25rem]">
        <Image
          src={heroImage}
          alt={heroAlt}
          fill
          priority
          fetchPriority="high"
          sizes="100vw"
          className="object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-brand-panel via-brand-panel/70 to-brand-panel/40" />
        <div className="absolute inset-0 bg-gradient-to-r from-brand-panel/60 via-transparent to-transparent" />

        <MarketingContainer className="relative z-10 flex h-full flex-col justify-end pb-10 pt-28 text-white md:pb-14 md:pt-32">
          <span className="mb-3 inline-flex w-fit items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3.5 py-1 text-xs font-extrabold uppercase tracking-wider text-white/90 backdrop-blur-sm">
            <BookOpenIcon className="size-3.5" />
            {copy.hero.eyebrow}
          </span>
          <h1 className="max-w-3xl font-brand text-3xl font-black tracking-tight text-white sm:text-4xl md:text-5xl lg:text-6xl">
            {copy.hero.heading}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/85 sm:text-base md:text-lg">
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
              <div className="flex flex-col items-center justify-center rounded-3xl border border-border/80 bg-brand-surface px-6 py-12 text-center shadow-xs sm:py-16">
                <div className="flex size-12 items-center justify-center rounded-full bg-brand-accent/10 text-brand-accent">
                  <BookOpenIcon className="size-6" />
                </div>
                <p className="mt-4 text-base font-bold text-brand">
                  No guides published yet.
                </p>
                <p className="mt-1 max-w-sm text-sm text-brand/70">
                  Check back soon for our newest travel and transit guides.
                </p>
              </div>
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
            <div className="flex flex-col items-center justify-center rounded-3xl border border-border/80 bg-brand-surface px-6 py-12 text-center shadow-xs sm:py-16">
              <div className="flex size-12 items-center justify-center rounded-full bg-brand-accent/10 text-brand-accent">
                <BookOpenIcon className="size-6" />
              </div>
              <p className="mt-4 text-base font-bold text-brand">
                {featured
                  ? "No more guides in this category yet."
                  : "No guides in this category yet."}
              </p>
              <p className="mt-1 max-w-sm text-sm text-brand/70">
                Check back soon for new route insights and airport transit tips across Albania.
              </p>
            </div>
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
