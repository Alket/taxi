/**
 * QA for Blog JSON import/export (admin paste path).
 * Run: npm run test:blog-json
 */
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import {
  applyBlogPostJsonToPage,
} from "../lib/blog/apply-blog-post-json"
import {
  blogPostToSections,
  pageContentToBlogPost,
} from "../lib/blog/cms"
import {
  BLOG_JSON_MAX_BLOCKS,
  BLOG_JSON_MAX_FAQ,
  BLOG_JSON_TEXT_MAX,
  parseBlogPostJson,
  parseBlogPostJsonText,
  safeParseBlogPostJson,
} from "../lib/blog/blog-post-schema"
import { BLOG_POSTS } from "../lib/blog/posts"
import type { BlogPost } from "../lib/blog/types"
import type { PageContentRecord } from "../lib/page-content-shared"

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

function samplePost(overrides: Partial<BlogPost> = {}): BlogPost {
  const base = BLOG_POSTS[0]
  if (!base) throw new Error("BLOG_POSTS empty")
  return {
    ...base,
    blocks: base.blocks.slice(0, 3),
    faq: base.faq.slice(0, 2),
    featured: false,
    ...overrides,
  }
}

function fakePage(slugId: string): PageContentRecord {
  return {
    slug: `blog/${slugId}`,
    label: `Blog · ${slugId}`,
    title: "SEO",
    description: "Desc",
    ogImage: "",
    sections: [],
    fromDatabase: true,
    locale: "en",
  }
}

function main() {
  console.log("\nQA blog JSON import\n")

  // --- Valid parse ---
  const seed = samplePost()
  try {
    const parsed = parseBlogPostJson(seed)
    if (parsed.slug === seed.slug && parsed.blocks.length === seed.blocks.length) {
      pass("V1 parseBlogPostJson seed", `${parsed.blocks.length} blocks`)
    } else {
      fail("V1 parseBlogPostJson seed", "shape mismatch")
    }
  } catch (e) {
    fail("V1 parseBlogPostJson seed", (e as Error).message)
  }

  // Fixture file used for CLI upsert
  try {
    const fixturePath = resolve(
      "data/blog/tirana-airport-transfers-taxis-uber-transportation-guide.json",
    )
    const fixture = JSON.parse(readFileSync(fixturePath, "utf8"))
    const post = parseBlogPostJson(fixture)
    const sections = blogPostToSections(post)
    if (sections.length <= 200 && post.blocks.length <= BLOG_JSON_MAX_BLOCKS) {
      pass(
        "V2 fixture file validates",
        `${post.blocks.length} blocks → ${sections.length} sections`,
      )
    } else {
      fail(
        "V2 fixture file validates",
        `sections=${sections.length} blocks=${post.blocks.length}`,
      )
    }
  } catch (e) {
    fail("V2 fixture file validates", (e as Error).message)
  }

  // Round-trip: post → sections → BlogPost → JSON → parse
  try {
    const original = samplePost({ featured: true })
    const page: PageContentRecord = {
      ...fakePage(original.slug),
      title: original.seoTitle,
      description: original.seoDescription,
      ogImage: original.heroImage.src,
      sections: blogPostToSections(original),
    }
    const exported = pageContentToBlogPost(page)
    if (!exported) {
      fail("R1 export pageContentToBlogPost", "null")
    } else {
      const text = JSON.stringify(exported)
      const reparsed = parseBlogPostJsonText(text)
      if (
        reparsed.title === original.title &&
        reparsed.blocks.length === original.blocks.length &&
        reparsed.faq.length === original.faq.length &&
        reparsed.featured === true
      ) {
        pass("R1 sections → export → parse round-trip")
      } else {
        fail(
          "R1 round-trip",
          JSON.stringify({
            title: reparsed.title,
            blocks: reparsed.blocks.length,
            faq: reparsed.faq.length,
            featured: reparsed.featured,
          }),
        )
      }
    }
  } catch (e) {
    fail("R1 round-trip", (e as Error).message)
  }

  // Apply locks slug
  try {
    const page = fakePage("is-there-uber-in-albania-2026")
    const post = samplePost({
      slug: "different-slug-from-url",
      title: "Imported Title",
      seoTitle: "Imported SEO",
    })
    const { page: next, slugMismatch, pageSlug } = applyBlogPostJsonToPage(
      page,
      post,
    )
    const adapted = pageContentToBlogPost(next)
    if (
      slugMismatch &&
      pageSlug === "is-there-uber-in-albania-2026" &&
      next.slug === "blog/is-there-uber-in-albania-2026" &&
      adapted?.slug === "is-there-uber-in-albania-2026" &&
      next.title.startsWith("Imported")
    ) {
      pass("S1 slug locked on apply", pageSlug)
    } else {
      fail(
        "S1 slug locked on apply",
        JSON.stringify({
          slugMismatch,
          pageSlug,
          pageSlugField: next.slug,
          adaptedSlug: adapted?.slug,
        }),
      )
    }
  } catch (e) {
    fail("S1 slug locked on apply", (e as Error).message)
  }

  // --- Rejects ---
  const badCases: { name: string; raw: unknown; expectPath?: string }[] = [
    {
      name: "javascript: hero src",
      raw: samplePost({
        heroImage: {
          src: "javascript:alert(1)",
          alt: "x",
          width: 1,
          height: 1,
        },
      }),
    },
    {
      name: "data: hero src",
      raw: samplePost({
        heroImage: {
          src: "data:image/png;base64,aaaa",
          alt: "x",
          width: 1,
          height: 1,
        },
      }),
    },
    {
      name: "protocol-relative hero src",
      raw: samplePost({
        heroImage: {
          src: "//evil.example/a.png",
          alt: "x",
          width: 1,
          height: 1,
        },
      }),
    },
    {
      name: "invalid slug chars",
      raw: samplePost({ slug: "Bad_Slug!" }),
    },
    {
      name: "unknown block type",
      raw: {
        ...samplePost(),
        blocks: [{ type: "script", text: "alert(1)" }],
      },
    },
    {
      name: "oversized paragraph",
      raw: samplePost({
        blocks: [{ type: "paragraph", text: "x".repeat(20_001) }],
      }),
    },
    {
      name: "too many blocks",
      raw: samplePost({
        blocks: Array.from({ length: BLOG_JSON_MAX_BLOCKS + 1 }, () => ({
          type: "paragraph" as const,
          text: "hi",
        })),
      }),
    },
    {
      name: "too many faqs",
      raw: samplePost({
        faq: Array.from({ length: BLOG_JSON_MAX_FAQ + 1 }, (_, i) => ({
          question: `Q${i}`,
          answer: `A${i}`,
        })),
      }),
    },
  ]

  for (const tc of badCases) {
    const result = safeParseBlogPostJson(tc.raw)
    if (!result.success) {
      pass(`X reject ${tc.name}`, result.error.issues[0]?.message ?? "")
    } else {
      fail(`X reject ${tc.name}`, "unexpectedly accepted")
    }
  }

  // Invalid JSON text
  try {
    parseBlogPostJsonText("{ not json")
    fail("X reject invalid JSON text", "did not throw")
  } catch (e) {
    const msg = (e as Error).message
    if (/Invalid JSON/i.test(msg)) pass("X reject invalid JSON text")
    else fail("X reject invalid JSON text", msg)
  }

  // Oversized text before parse
  try {
    parseBlogPostJsonText("x".repeat(BLOG_JSON_TEXT_MAX + 1))
    fail("X reject oversized JSON text", "did not throw")
  } catch (e) {
    const msg = (e as Error).message
    if (/too large/i.test(msg)) pass("X reject oversized JSON text")
    else fail("X reject oversized JSON text", msg)
  }

  // Prototype pollution keys stripped / ignored
  try {
    const polluted = {
      ...samplePost(),
      __proto__: { polluted: true },
      constructor: { prototype: { polluted: true } },
    }
    const parsed = parseBlogPostJson(polluted)
    const protoPolluted =
      Object.prototype.hasOwnProperty.call(parsed, "polluted") ||
      // eslint-disable-next-line no-prototype-builtins
      ({} as { polluted?: boolean }).polluted === true
    if (!protoPolluted && parsed.slug === seed.slug) {
      pass("X prototype pollution keys ignored")
    } else {
      fail("X prototype pollution keys ignored", "pollution detected")
    }
  } catch (e) {
    // Rejecting polluted payload is also fine
    pass("X prototype pollution keys ignored", (e as Error).message)
  }

  // Safe image src accepted
  for (const src of [
    "/uploads/pages/hero.jpg",
    "https://images.unsplash.com/photo-1",
    "http://localhost:3000/uploads/a.png",
  ]) {
    const result = safeParseBlogPostJson(
      samplePost({
        heroImage: { src, alt: "ok", width: 1600, height: 900 },
      }),
    )
    if (result.success) pass(`V3 accept hero src ${src.slice(0, 24)}…`)
    else
      fail(
        `V3 accept hero src ${src.slice(0, 24)}…`,
        result.error.issues[0]?.message,
      )
  }

  const failed = results.filter((r) => r.status === "FAIL")
  console.log(
    `\n${results.length - failed.length}/${results.length} passed` +
      (failed.length ? ` · ${failed.length} failed` : ""),
  )
  if (failed.length) process.exit(1)
}

main()
