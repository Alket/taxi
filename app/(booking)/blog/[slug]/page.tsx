import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { BlogPostView } from "@/components/marketing/blog/blog-post-view"
import { JsonLd } from "@/components/marketing/json-ld"
import {
  authorFromCatalog,
  categoryLabelFromCatalog,
  getBlogCatalog,
} from "@/lib/blog/catalog"
import { getRequestLocale } from "@/lib/i18n/get-locale"
import { localePath, localizedAlternates } from "@/lib/i18n/locales"
import { getAppBaseUrl } from "@/lib/mail"
import { getBlogPostFromCms } from "@/lib/page-content"
import {
  buildBlogPostingJsonLd,
  buildBreadcrumbJsonLd,
  buildFaqPageJsonLd,
} from "@/lib/structured-data"

export const dynamic = "force-dynamic"

type PageProps = {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params
  const locale = await getRequestLocale()
  const post = await getBlogPostFromCms(slug, locale)
  if (!post) return { title: "Guide not found" }

  const path = `/blog/${post.slug}`
  const base = getAppBaseUrl().replace(/\/+$/, "")
  const ogImage = post.heroImage.src.startsWith("http")
    ? post.heroImage.src
    : `${base}${post.heroImage.src}`

  return {
    title: post.seoTitle,
    description: post.seoDescription,
    alternates: localizedAlternates(path, locale),
    openGraph: {
      title: post.seoTitle,
      description: post.seoDescription,
      url: `${base}${localePath(path, locale)}`,
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
      title: post.seoTitle,
      description: post.seoDescription,
      images: [ogImage],
    },
  }
}

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params
  const locale = await getRequestLocale()
  const [post, catalog] = await Promise.all([
    getBlogPostFromCms(slug, locale),
    getBlogCatalog(),
  ])
  if (!post) notFound()

  const author = authorFromCatalog(catalog, post.authorId)
  const categoryLabel = categoryLabelFromCatalog(catalog, post.category)
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
        })}
      />
      <JsonLd
        data={buildBreadcrumbJsonLd([
          { name: "Home", url: localePath("/", locale) },
          { name: "Blog", url: localePath("/blog", locale) },
          {
            name: categoryLabel,
            url: localePath(`/blog?category=${post.category}`, locale),
          },
          { name: post.title, url: localizedPath },
        ])}
      />
      {faqLd ? <JsonLd data={faqLd} /> : null}
      <BlogPostView
        post={post}
        locale={locale}
        categoryLabel={categoryLabel}
        author={author}
      />
    </>
  )
}
