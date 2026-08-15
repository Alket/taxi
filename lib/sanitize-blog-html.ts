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

const BLOG_URI_REGEXP = /^(?:(?:https?|mailto|tel):|\/(?!\/)|#)/i

function isSafeHref(href: string): boolean {
  const value = href.trim()
  if (!value) return false
  if (value.startsWith("#") && !/^#?javascript:/i.test(value)) return true
  if (value.startsWith("/") && !value.startsWith("//")) return true
  try {
    const url = new URL(value)
    return ["http:", "https:", "mailto:", "tel:"].includes(url.protocol)
  } catch {
    return false
  }
}

function afterSanitizeBlogAttributes(node: Element) {
  if (node.tagName !== "A") return

  const href = node.getAttribute("href")?.trim() ?? ""
  if (!isSafeHref(href)) {
    node.removeAttribute("href")
  }

  if (node.getAttribute("target") === "_blank") {
    node.setAttribute("rel", "noopener noreferrer nofollow")
  } else if (!node.getAttribute("rel")) {
    node.setAttribute("rel", "nofollow")
  }
}

/**
 * Sanitize blog rich text for safe HTML rendering.
 * Keeps common inline tags, lists (ul/ol/li); strips scripts and unsafe blocks.
 * Hooks are added/removed around this call so SVG sanitization is untouched.
 */
export function sanitizeBlogHtml(raw: string): string {
  DOMPurify.addHook("afterSanitizeAttributes", afterSanitizeBlogAttributes)
  try {
    return DOMPurify.sanitize(raw ?? "", {
      ALLOWED_TAGS: [...ALLOWED_TAGS],
      ALLOWED_ATTR: [...ALLOWED_ATTR],
      ALLOW_DATA_ATTR: false,
      ALLOWED_URI_REGEXP: BLOG_URI_REGEXP,
    })
  } finally {
    DOMPurify.removeHook("afterSanitizeAttributes", afterSanitizeBlogAttributes)
  }
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
