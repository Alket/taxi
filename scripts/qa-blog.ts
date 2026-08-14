/**
 * QA for admin-managed blog posts (CMS + public routes).
 * Run: npm run test:blog
 * Optional: QA_BASE_URL=http://localhost:3000
 */
import { PrismaClient } from "@prisma/client"

import { BLOG_POSTS } from "../lib/blog/posts"
import {
  blogPostToSections,
  emptyBlogSections,
  pageContentToBlogPost,
  slugifyBlogId,
} from "../lib/blog/cms"
import { archivePostsFromList } from "../lib/blog/posts"
import {
  BLOG_META_KEYS,
  blogArchiveCopyFromSections,
  isBlogSlug,
  isCorePageSlug,
  parseSections,
} from "../lib/page-content-shared"
import {
  createBlogPage,
  deleteAdminPage,
  getBlogPostFromCms,
  listAdminPages,
  listBlogPostsFromCms,
  pathForSlug,
  resolvePageContent,
  resolvePageDefinition,
  setDestinationFeatured,
} from "../lib/page-content"
import { exportPageI18nPack } from "../lib/page-content-i18n-pack"

const base = process.env.QA_BASE_URL || "http://localhost:3000"
const prisma = new PrismaClient()

type Result = { status: "PASS" | "FAIL"; case: string; detail?: string }
const results: Result[] = []

function pass(c: string, d = "") {
  results.push({ status: "PASS", case: c, detail: d })
  console.log("PASS:", c, d || "")
}
function fail(c: string, d = "") {
  results.push({ status: "FAIL", case: c, detail: d })
  console.log("FAIL:", c, "—", d)
}

async function httpStatus(path: string) {
  try {
    const res = await fetch(`${base}${path}`, {
      headers: { "ngrok-skip-browser-warning": "true" },
      redirect: "manual",
    })
    return res.status
  } catch (error) {
    return `ERR:${(error as Error).message}`
  }
}

async function httpText(path: string) {
  try {
    const res = await fetch(`${base}${path}`, {
      headers: { "ngrok-skip-browser-warning": "true" },
    })
    return { status: res.status, text: await res.text() }
  } catch (error) {
    return { status: 0, text: (error as Error).message }
  }
}

async function main() {
  console.log(`\nQA blog CMS @ ${base}\n`)

  const seedSlug = BLOG_POSTS[0]?.slug
  if (!seedSlug) {
    fail("B0 seed posts", "BLOG_POSTS empty")
    throw new Error("No seed blog posts")
  }

  // --- Definitions / helpers ---
  let defsOk = true
  for (const post of BLOG_POSTS) {
    const slug = `blog/${post.slug}`
    if (!isBlogSlug(slug)) {
      defsOk = false
      fail("D1 isBlogSlug", slug)
      break
    }
    const def = await resolvePageDefinition(slug)
    if (!def || def.path !== `/blog/${post.slug}`) {
      defsOk = false
      fail("D1 definition", `${slug} path=${def?.path}`)
      break
    }
    const keys = new Set(def.defaults.sections.map((s) => s.key))
    for (const need of BLOG_META_KEYS) {
      if (!keys.has(need)) {
        defsOk = false
        fail("D1 meta keys", `${post.slug} missing ${need}`)
        break
      }
    }
    if (!defsOk) break
    if (!keys.has("hero.image")) {
      defsOk = false
      fail("D1 hero.image", post.slug)
      break
    }
  }
  if (defsOk) {
    pass("D1 built-in blog definitions + meta keys", String(BLOG_POSTS.length))
  }

  if (pathForSlug(`blog/${seedSlug}`) === `/blog/${seedSlug}`) {
    pass("D2 pathForSlug blog", `/blog/${seedSlug}`)
  } else {
    fail("D2 pathForSlug", pathForSlug(`blog/${seedSlug}`))
  }

  // --- Blog archive core page ---
  if (isCorePageSlug("blog") && !isBlogSlug("blog")) {
    pass("D3 core slug blog vs post prefix")
  } else {
    fail("D3 core slug blog", "collision with isBlogSlug")
  }

  const archiveDef = await resolvePageDefinition("blog")
  if (
    archiveDef?.slug === "blog" &&
    archiveDef.path === "/blog" &&
    archiveDef.label === "Blog archive"
  ) {
    pass("D4 blog archive definition")
  } else {
    fail("D4 blog archive definition", JSON.stringify(archiveDef?.path))
  }

  const archiveKeys = new Set(
    archiveDef?.defaults.sections.map((s) => s.key) ?? [],
  )
  const needArchiveKeys = [
    "hero.eyebrow",
    "hero.heading",
    "hero.text",
    "cta.eyebrow",
    "cta.heading",
    "cta.text",
    "cta.button",
  ]
  if (needArchiveKeys.every((k) => archiveKeys.has(k))) {
    pass("D5 blog archive section keys")
  } else {
    fail(
      "D5 blog archive section keys",
      needArchiveKeys.filter((k) => !archiveKeys.has(k)).join(","),
    )
  }

  const archiveCopy = blogArchiveCopyFromSections(
    archiveDef?.defaults.sections ?? [],
  )
  if (
    archiveCopy.hero.eyebrow === "Landed Guides" &&
    archiveCopy.cta.button === "Get my fixed fare"
  ) {
    pass("D6 blogArchiveCopyFromSections defaults")
  } else {
    fail(
      "D6 archive copy",
      `${archiveCopy.hero.eyebrow} / ${archiveCopy.cta.button}`,
    )
  }

  const adminPages = await listAdminPages()
  if (adminPages.some((p) => p.slug === "blog" && !p.isBlog)) {
    pass("D7 blog archive in admin core list")
  } else {
    fail("D7 blog archive admin list", "missing core blog page")
  }

  // --- Adapter round-trip ---
  const seed = BLOG_POSTS[0]!
  const sections = blogPostToSections(seed)
  const adapted = pageContentToBlogPost({
    slug: `blog/${seed.slug}`,
    label: `Blog · ${seed.title}`,
    title: seed.seoTitle,
    description: seed.seoDescription,
    ogImage: seed.heroImage.src,
    sections,
    fromDatabase: false,
    locale: "en",
    hasLocaleRow: true,
    updatedAt: seed.updatedAt,
  })
  if (
    adapted &&
    adapted.slug === seed.slug &&
    adapted.title === seed.title &&
    adapted.category === seed.category &&
    adapted.blocks.length === seed.blocks.length &&
    adapted.faq.length === seed.faq.length &&
    adapted.featured === Boolean(seed.featured)
  ) {
    pass(
      "A1 seed → sections → BlogPost",
      `${adapted.blocks.length} blocks, ${adapted.faq.length} faqs`,
    )
  } else {
    fail(
      "A1 adapter round-trip",
      JSON.stringify({
        slug: adapted?.slug,
        blocks: adapted?.blocks.length,
        faq: adapted?.faq.length,
        featured: adapted?.featured,
      }),
    )
  }

  const empty = emptyBlogSections("QA Empty Title")
  const emptyPost = pageContentToBlogPost({
    slug: "blog/qa-empty-title",
    label: "Blog · QA Empty Title",
    title: "QA Empty Title",
    description: "desc",
    ogImage: "",
    sections: empty,
    fromDatabase: false,
    locale: "en",
    hasLocaleRow: true,
  })
  if (
    emptyPost &&
    emptyPost.title === "QA Empty Title" &&
    emptyPost.blocks.length >= 1 &&
    emptyPost.faq.length >= 1
  ) {
    pass("A2 emptyBlogSections adapts", `${emptyPost.blocks.length} blocks`)
  } else {
    fail("A2 emptyBlogSections", JSON.stringify(emptyPost?.title))
  }

  // New section types survive parseSections
  const typed = parseSections([
    {
      id: "1",
      type: "callout",
      key: "body.1",
      heading: "Tip",
      body: "Callout body",
    },
    {
      id: "2",
      type: "list",
      key: "body.2",
      items: ["One", "Two"],
      listStyle: "ol",
    },
    {
      id: "3",
      type: "table",
      key: "body.3",
      heading: "Compare",
      headers: ["A", "B"],
      rows: [["1", "2"]],
    },
    { id: "4", type: "mid_cta", key: "body.4" },
  ])
  const typedPost = pageContentToBlogPost({
    slug: "blog/qa-typed",
    label: "Blog · Typed",
    title: "Typed",
    description: "d",
    ogImage: "",
    sections: [
      {
        id: "t",
        type: "heading",
        key: "title.heading",
        heading: "Typed",
        level: 1,
      },
      {
        id: "c",
        type: "text",
        key: "meta.category",
        body: "airport-transport",
      },
      ...typed,
    ],
    fromDatabase: false,
    locale: "en",
    hasLocaleRow: true,
  })
  const types = typedPost?.blocks.map((b) => b.type) ?? []
  if (
    types.includes("callout") &&
    types.includes("ol") &&
    types.includes("table") &&
    types.includes("mid_cta")
  ) {
    pass("A3 callout/list/table/mid_cta blocks", types.join(","))
  } else {
    fail("A3 block types", types.join(","))
  }

  // --- CMS list / get ---
  const posts = await listBlogPostsFromCms("en")
  if (posts.length >= BLOG_POSTS.length) {
    pass("C1 listBlogPostsFromCms", String(posts.length))
  } else {
    fail(
      "C1 listBlogPostsFromCms",
      `got ${posts.length}, expected >= ${BLOG_POSTS.length}`,
    )
  }

  let shapeOk = true
  for (const post of posts) {
    if (
      !post.slug ||
      !post.title ||
      !post.excerpt ||
      !post.category ||
      !post.heroImage?.src ||
      !Array.isArray(post.blocks)
    ) {
      shapeOk = false
      fail("C2 post shape", post.slug || "missing slug")
      break
    }
  }
  if (shapeOk) pass("C2 listed posts have required fields")

  const bySlug = await getBlogPostFromCms(seedSlug, "en")
  if (bySlug?.slug === seedSlug && bySlug.title) {
    pass("C3 getBlogPostFromCms seed", seedSlug)
  } else {
    fail("C3 getBlogPostFromCms", JSON.stringify(bySlug?.slug))
  }

  const archive = archivePostsFromList(posts, "all")
  if (archive.featured && archive.featured.slug) {
    pass(
      "C4 archivePostsFromList",
      `featured=${archive.featured.slug} rest=${archive.rest.length}`,
    )
  } else {
    fail("C4 archivePostsFromList", "no featured")
  }

  const admin = await listAdminPages()
  const blogAdmin = admin.filter((p) => p.isBlog)
  if (blogAdmin.length >= BLOG_POSTS.length) {
    pass("C5 listAdminPages blog group", String(blogAdmin.length))
  } else {
    fail("C5 listAdminPages blog", String(blogAdmin.length))
  }

  // --- Create / feature / delete custom post ---
  const qaId = `qa-blog-${Date.now().toString(36)}`
  const qaTitle = `QA Blog ${qaId}`
  let createdSlug = ""
  try {
    const created = await createBlogPage({ title: qaTitle, slug: qaId })
    createdSlug = created.slug
    if (created.slug === `blog/${qaId}` && isBlogSlug(created.slug)) {
      pass("C6 createBlogPage", created.slug)
    } else {
      fail("C6 createBlogPage", created.slug)
    }

    const fetched = await getBlogPostFromCms(qaId, "en")
    if (fetched?.slug === qaId && fetched.title.includes("QA Blog")) {
      pass("C7 custom post readable", fetched.title)
    } else {
      fail("C7 custom post readable", JSON.stringify(fetched?.title))
    }

    await setDestinationFeatured(created.slug, true)
    const featuredPage = await resolvePageContent(created.slug, "en")
    const featuredPost = featuredPage
      ? pageContentToBlogPost(featuredPage)
      : null
    if (featuredPost?.featured) pass("C8 feature custom blog")
    else fail("C8 feature custom blog", String(featuredPost?.featured))

    await setDestinationFeatured(created.slug, false)
    const unfeaturedPage = await resolvePageContent(created.slug, "en")
    const unfeaturedPost = unfeaturedPage
      ? pageContentToBlogPost(unfeaturedPage)
      : null
    if (unfeaturedPost && !unfeaturedPost.featured) {
      pass("C9 unfeature custom blog")
    } else {
      fail("C9 unfeature", String(unfeaturedPost?.featured))
    }

    const del = await deleteAdminPage(created.slug)
    if (del.mode === "deleted") pass("C10 delete custom blog", del.mode)
    else fail("C10 delete custom blog", del.mode)

    const gone = await getBlogPostFromCms(qaId, "en")
    if (!gone) pass("C11 deleted post not public")
    else fail("C11 deleted still public", gone.slug)

    createdSlug = ""
  } catch (error) {
    fail("C6-C11 create/feature/delete", (error as Error).message)
    if (createdSlug) {
      try {
        await prisma.pageContent.deleteMany({ where: { slug: createdSlug } })
      } catch {
        /* ignore cleanup */
      }
    }
  }

  // Duplicate create should fail
  try {
    await createBlogPage({
      title: seed.title,
      slug: seed.slug,
    })
    fail("C12 duplicate built-in rejected", "created unexpectedly")
  } catch (error) {
    const msg = (error as Error).message
    if (/already exists/i.test(msg)) pass("C12 duplicate built-in rejected")
    else fail("C12 duplicate message", msg)
  }

  if (slugifyBlogId("Hello World!!") === "hello-world") {
    pass("C13 slugifyBlogId", "hello-world")
  } else {
    fail("C13 slugifyBlogId", slugifyBlogId("Hello World!!"))
  }

  // --- i18n pack includes blog ---
  try {
    const pack = await exportPageI18nPack()
    const blogs = pack.pages.filter(
      (p) => p.kind === "blog" && p.slug.startsWith("blog/"),
    )
    if (blogs.length >= BLOG_POSTS.length) {
      pass("I1 i18n pack blog posts", String(blogs.length))
    } else {
      fail("I1 i18n pack blog posts", String(blogs.length))
    }
    const seedPack = blogs.find((p) => p.slug === `blog/${seedSlug}`)
    const enKeys = Object.keys(seedPack?.byLocale.en?.sections ?? {})
    if (
      seedPack &&
      enKeys.includes("title.heading") &&
      enKeys.includes("meta.excerpt")
    ) {
      pass("I2 seed blog translation keys", String(enKeys.length))
    } else {
      fail("I2 seed blog keys", enKeys.slice(0, 8).join(","))
    }

    const archivePack = pack.pages.find((p) => p.slug === "blog")
    const archiveKeys = Object.keys(archivePack?.byLocale.en?.sections ?? {})
    if (
      archivePack &&
      (archivePack.kind === "blog" || archivePack.kind === "core") &&
      archiveKeys.includes("hero.eyebrow") &&
      archiveKeys.includes("cta.button")
    ) {
      pass("I3 blog archive in i18n pack", archivePack.kind)
    } else {
      fail(
        "I3 blog archive in i18n pack",
        JSON.stringify({
          kind: archivePack?.kind,
          keys: archiveKeys.slice(0, 8),
        }),
      )
    }
  } catch (error) {
    fail("I1 i18n pack", (error as Error).message)
  }

  // --- HTTP ---
  const archiveHttp = await httpText("/blog")
  if (archiveHttp.status === 200) pass("H1 /blog 200")
  else fail("H1 /blog", String(archiveHttp.status))

  if (
    archiveHttp.status === 200 &&
    (archiveHttp.text.includes("Landed Guides") ||
      archiveHttp.text.includes("Airport Transport"))
  ) {
    pass("H2 /blog shows archive chrome")
  } else if (archiveHttp.status === 200) {
    fail("H2 /blog chrome", "expected headings missing")
  }

  if (
    archiveHttp.status === 200 &&
    archiveHttp.text.includes("Get my fixed fare")
  ) {
    pass("H2b /blog shows fare CTA")
  } else if (archiveHttp.status === 200) {
    fail("H2b fare CTA", "button text missing")
  }

  const resolvedArchive = await resolvePageContent("blog", "en")
  const liveCopy = blogArchiveCopyFromSections(resolvedArchive?.sections ?? [])
  const heroNeedle = liveCopy.hero.heading.replace(/&/g, "&amp;")
  if (
    archiveHttp.status === 200 &&
    (archiveHttp.text.includes(liveCopy.hero.heading) ||
      archiveHttp.text.includes(heroNeedle) ||
      archiveHttp.text.includes("Airport Transport"))
  ) {
    pass("H2c /blog renders CMS hero heading")
  } else if (archiveHttp.status === 200) {
    fail("H2c CMS hero", liveCopy.hero.heading)
  }

  const postHttp = await httpText(`/blog/${seedSlug}`)
  if (postHttp.status === 200) pass("H3 /blog/{seed} 200", seedSlug)
  else fail("H3 /blog/{seed}", String(postHttp.status))

  if (
    postHttp.status === 200 &&
    (postHttp.text.includes(seed.title) ||
      postHttp.text.includes(seed.seoTitle.split("|")[0]!.trim()))
  ) {
    pass("H4 post page shows title")
  } else if (postHttp.status === 200) {
    fail("H4 post title", seed.title)
  }

  const missing = await httpStatus("/blog/definitely-not-a-real-post-xyz")
  if (missing === 404) pass("H5 unknown blog slug 404")
  else fail("H5 unknown blog slug", String(missing))

  const itArchive = await httpStatus("/it/blog")
  if (itArchive === 200) pass("H6 /it/blog 200")
  else fail("H6 /it/blog", String(itArchive))

  const passed = results.filter((r) => r.status === "PASS").length
  const failed = results.filter((r) => r.status === "FAIL").length
  console.log("\n===== QA SUMMARY =====")
  console.log(`PASS=${passed} FAIL=${failed}`)
  for (const r of results.filter((x) => x.status === "FAIL")) {
    console.log(`  FAIL: ${r.case} | ${r.detail}`)
  }

  await prisma.$disconnect()
  if (failed > 0) process.exit(1)
}

main().catch(async (error) => {
  console.error(error)
  await prisma.$disconnect()
  process.exit(1)
})
