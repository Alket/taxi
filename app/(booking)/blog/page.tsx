import type { Metadata } from "next"

import { BlogArchive } from "@/components/marketing/blog/blog-archive"
import { JsonLd } from "@/components/marketing/json-ld"
import { archivePostsFromList, parseBlogFilter } from "@/lib/blog"
import { getRequestLocale } from "@/lib/i18n/get-locale"
import { localePath, localizedAlternates } from "@/lib/i18n/locales"
import { getAppBaseUrl } from "@/lib/mail"
import {
  blogArchiveCopyFromSections,
  listBlogPostsFromCms,
  resolvePageContent,
} from "@/lib/page-content"
import { buildBreadcrumbJsonLd } from "@/lib/structured-data"

export const dynamic = "force-dynamic"

type PageProps = {
  searchParams: Promise<{ category?: string }>
}

export async function generateMetadata({
  searchParams,
}: PageProps): Promise<Metadata> {
  const locale = await getRequestLocale()
  const { category } = await searchParams
  const filter = parseBlogFilter(category)
  const path =
    filter === "all" ? "/blog" : `/blog?category=${filter}`
  const [page, posts] = await Promise.all([
    resolvePageContent("blog", locale),
    listBlogPostsFromCms(locale),
  ])
  const { featured } = archivePostsFromList(posts, filter)
  const base = getAppBaseUrl().replace(/\/+$/, "")
  const hero = featured?.heroImage
  const pageOg = page?.ogImage?.trim()
  const ogSource = pageOg || hero?.src
  const ogImage = ogSource
    ? ogSource.startsWith("http")
      ? ogSource
      : `${base}${ogSource}`
    : undefined

  return {
    title: page?.title || "Albania Airport Transport Guides | Landed",
    description:
      page?.description ||
      "TIA transit tips, destination routes, and fixed-price airport transfer guides for Albania travellers.",
    alternates: localizedAlternates(path, locale),
    openGraph: {
      title:
        page?.title || "Albania Airport Transport & Travel Guides",
      description:
        page?.description ||
        "Practical Tirana Airport guides—routes, meet & greet, and fixed-price transfers.",
      url: `${base}${localePath(path, locale)}`,
      type: "website",
      ...(ogImage
        ? {
            images: [
              {
                url: ogImage,
                alt: hero?.alt || page?.title || "Landed blog",
              },
            ],
          }
        : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: page?.title || "Albania Airport Transport Guides | Landed",
      description:
        page?.description ||
        "TIA transit tips and fixed-price transfer guides for Albania.",
      ...(ogImage ? { images: [ogImage] } : {}),
    },
  }
}

export default async function BlogArchivePage({ searchParams }: PageProps) {
  const locale = await getRequestLocale()
  const { category } = await searchParams
  const filter = parseBlogFilter(category)
  const blogPath = localePath("/blog", locale)
  const [page, posts] = await Promise.all([
    resolvePageContent("blog", locale),
    listBlogPostsFromCms(locale),
  ])
  const { featured, rest } = archivePostsFromList(posts, filter)
  const copy = blogArchiveCopyFromSections(page?.sections ?? [])

  return (
    <>
      <JsonLd
        data={buildBreadcrumbJsonLd([
          { name: "Home", url: localePath("/", locale) },
          { name: "Blog", url: blogPath },
        ])}
      />
      <BlogArchive
        locale={locale}
        filter={filter}
        featured={featured}
        rest={rest}
        copy={copy}
      />
    </>
  )
}
