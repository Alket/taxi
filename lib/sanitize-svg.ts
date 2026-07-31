import DOMPurify from "isomorphic-dompurify"

/**
 * Sanitize SVG markup for safe storage/serving.
 * Strips scripts, event handlers (onload/onclick/…), foreignObject,
 * embeds, and dangerous URI schemes. Keeps a usable SVG profile for icons.
 */
export function sanitizeSvgMarkup(raw: string): string {
  const cleaned = DOMPurify.sanitize(raw, {
    USE_PROFILES: { svg: true, svgFilters: true },
    FORBID_TAGS: ["script", "foreignObject", "iframe", "object", "embed"],
    // javascript:/data: script payloads in hrefs are blocked by DOMPurify URI rules.
  }).trim()

  if (!cleaned || !/<svg[\s>]/i.test(cleaned)) {
    throw new Error("SVG was empty or unsafe after sanitization.")
  }

  return cleaned
}
