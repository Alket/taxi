import { cache } from "react"
import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { BlogPostView } from "@/components/marketing/blog/blog-post-view"
import { JsonLd } from "@/components/marketing/json-ld"
import {
  authorFromCatalog,
  categoryLabelFromCatalog,
  getBlogCatalog,
} from "@/lib/blog/catalog"
import { pageContentToBlogPost } from "@/lib/blog/cms"
import { getRelatedDestinations } from "@/lib/blog"
import { getRequestLocale } from "@/lib/i18n/get-locale"
import {
  DEFAULT_LOCALE,
  OG_LOCALE,
  englishOnlyAlternates,
  localePath,
  localizedAlternates,
} from "@/lib/i18n/locales"
import { t } from "@/lib/i18n/t"
import { getAppBaseUrl } from "@/lib/mail"
import {
  getAvailablePageLocales,
  resolveDestinationCards,
  resolvePageContent,
} from "@/lib/page-content"
import {
  localizeFallbackSearchCopy,
  searchTitle,
} from "@/lib/seo/search-meta"
import {
  buildBlogPostingJsonLd,
  buildBreadcrumbJsonLd,
  buildFaqPageJsonLd,
} from "@/lib/structured-data"

export const dynamic = "force-dynamic"

const loadBlogPageRecord = cache((slug: string, locale: string) =>
  resolvePageContent(`blog/${slug}`, locale),
)

type PageProps = {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params
  const locale = await getRequestLocale()
  const [pageRecord, englishRecord] = await Promise.all([
    loadBlogPageRecord(slug, locale),
    locale === DEFAULT_LOCALE
      ? Promise.resolve(null)
      : loadBlogPageRecord(slug, DEFAULT_LOCALE),
  ])
  const post = pageRecord ? pageContentToBlogPost(pageRecord) : null
  const englishPost = englishRecord ? pageContentToBlogPost(englishRecord) : null
  if (!post) return { title: "Guide not found" }

  const path = `/blog/${post.slug}`
  const base = getAppBaseUrl().replace(/\/+$/, "")
  const ogImage = post.heroImage.src.startsWith("http")
    ? post.heroImage.src
    : `${base}${post.heroImage.src}`

  const localized = localizeFallbackSearchCopy(
    locale,
    post.seoTitle,
    post.seoDescription,
    englishPost?.seoTitle || post.seoTitle,
    englishPost?.seoDescription || post.seoDescription,
  )
  const title = searchTitle(localized.title)
  const description = localized.description
  const isTranslated =
    locale === DEFAULT_LOCALE || Boolean(pageRecord?.hasLocaleRow)
  const availableLocales = isTranslated
    ? await getAvailablePageLocales(`blog/${post.slug}`)
    : [DEFAULT_LOCALE]
  return {
    title,
    description,
    alternates: isTranslated
      ? localizedAlternates(path, locale, availableLocales)
      : englishOnlyAlternates(path),
    openGraph: {
      title: title.absolute,
      description,
      url: `${base}${localePath(path, locale)}`,
      locale: OG_LOCALE[locale],
      type: "article",
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt,
      images: [
        {
          url: ogImage,
          width: post.heroImage.width,
          height: post.heroImage.height,
          alt: post.heroImage.alt,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: title.absolute,
      description,
      images: [ogImage],
    },
  }
}

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params
  const locale = await getRequestLocale()
  const [pageRecord, catalog, destinationCards] = await Promise.all([
    loadBlogPageRecord(slug, locale),
    getBlogCatalog(),
    resolveDestinationCards(locale),
  ])
  const post = pageRecord ? pageContentToBlogPost(pageRecord) : null
  if (!post) notFound()

  const author = authorFromCatalog(catalog, post.authorId)
  const categoryLabel = categoryLabelFromCatalog(catalog, post.category)
  const relatedDestinations = getRelatedDestinations(post, destinationCards)
  const path = `/blog/${post.slug}`
  const localizedPath = localePath(path, locale)
  const faqLd = buildFaqPageJsonLd(post.faq)

  return (
    <>
      <JsonLd
        data={buildBlogPostingJsonLd({
          headline: post.title,
          description: post.seoDescription,
          url: localizedPath,
          image: post.heroImage.src,
          datePublished: post.publishedAt,
          dateModified: post.updatedAt,
          authorName: author.name,
          inLanguage: locale,
        })}
      />
      <JsonLd
        data={buildBreadcrumbJsonLd([
          { name: t(locale, "nav.home") || "Home", url: localePath("/", locale) },
          { name: t(locale, "nav.blog") || "Blog", url: localePath("/blog", locale) },
          { name: post.title, url: localizedPath },
        ])}
      />
      {faqLd ? <JsonLd data={faqLd} /> : null}
      <BlogPostView
        post={post}
        locale={locale}
        categoryLabel={categoryLabel}
        author={author}
        relatedDestinations={relatedDestinations}
      />
    </>
  )
}
