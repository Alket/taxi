import DOMPurify from "isomorphic-dompurify"

/** Formatting allowed in blog CMS text fields (inline + simple lists). */
const ALLOWED_TAGS = [
  "br",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "a",
  "span",
  "code",
  "mark",
  "sup",
  "sub",
  "ul",
  "ol",
  "li",
] as const

/**
 * No `class` — avoids layout/UI spoofing via CMS HTML.
 * DOMPurify default URI rules block javascript:/data: in href.
 */
const ALLOWED_ATTR = ["href", "target", "rel", "title"] as const

/**
 * Sanitize blog rich text for safe HTML rendering.
 * Keeps common inline tags, lists (ul/ol/li); strips scripts and unsafe blocks.
 */
export function sanitizeBlogHtml(raw: string): string {
  const cleaned = DOMPurify.sanitize(raw ?? "", {
    ALLOWED_TAGS: [...ALLOWED_TAGS],
    ALLOWED_ATTR: [...ALLOWED_ATTR],
    ALLOW_DATA_ATTR: false,
  })

  // Force safe rel on any leftover anchors (tabnabbing / opener).
  return cleaned.replace(
    /<a\b([^>]*?)>/gi,
    (_match, attrs: string) => {
      let next = attrs
      if (/\btarget\s*=\s*["_']?_blank/i.test(next)) {
        if (/\brel\s*=/i.test(next)) {
          next = next.replace(
            /\brel\s*=\s*["'][^"']*["']/i,
            'rel="noopener noreferrer nofollow"',
          )
        } else {
          next += ' rel="noopener noreferrer nofollow"'
        }
      } else if (!/\brel\s*=/i.test(next)) {
        next += ' rel="nofollow"'
      }
      return `<a${next}>`
    },
  )
}

/** Plain text for TOC labels / heading ids. */
export function stripBlogHtml(raw: string): string {
  return DOMPurify.sanitize(raw ?? "", {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
  })
    .replace(/\s+/g, " ")
    .trim()
}
