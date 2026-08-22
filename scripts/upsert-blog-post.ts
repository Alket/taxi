/**
 * Upsert a blog post from BlogPost JSON into PageContent (locale: en).
 *
 * Usage:
 *   npx tsx scripts/upsert-blog-post.ts path/to/post.json
 *   cat post.json | npx tsx scripts/upsert-blog-post.ts -
 *
 * Env: DATABASE_URL (same as the app).
 */
import { readFileSync } from "node:fs"
import { PrismaClient } from "@prisma/client"

import { blogPostToSections } from "@/lib/blog/cms"
import { parseBlogPostJson } from "@/lib/blog/blog-post-schema"
import { DEFAULT_LOCALE } from "@/lib/i18n/locales"

const prisma = new PrismaClient()

function readJson(arg: string): unknown {
  if (arg === "-") {
    return JSON.parse(readFileSync(0, "utf8"))
  }
  return JSON.parse(readFileSync(arg, "utf8"))
}

async function main() {
  const file = process.argv[2]
  if (!file) {
    console.error(
      "Usage: npx tsx scripts/upsert-blog-post.ts <post.json|->",
    )
    process.exit(1)
  }

  let raw: unknown
  try {
    raw = readJson(file)
  } catch {
    throw new Error("Invalid JSON — check for missing commas or quotes.")
  }

  const post = parseBlogPostJson(raw)
  const slug = `blog/${post.slug.trim()}`
  const sections = blogPostToSections(post)

  const data = {
    label: `Blog · ${post.title}`,
    title: (post.seoTitle || post.title).slice(0, 70),
    description: (post.seoDescription || post.excerpt || "").slice(0, 160),
    ogImage: post.heroImage.src,
    sections,
  }

  const row = await prisma.pageContent.upsert({
    where: { slug_locale: { slug, locale: DEFAULT_LOCALE } },
    create: {
      slug,
      locale: DEFAULT_LOCALE,
      ...data,
    },
    update: data,
  })

  console.log(
    JSON.stringify(
      {
        ok: true,
        slug: row.slug,
        locale: row.locale,
        title: row.title,
        path: `/blog/${post.slug}`,
        blocks: post.blocks.length,
        faq: post.faq.length,
        featured: Boolean(post.featured),
      },
      null,
      2,
    ),
  )
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
