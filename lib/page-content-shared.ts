export const PAGE_SECTION_TYPES = [
  "heading",
  "text",
  "image",
  "faq_item",
  "attraction",
] as const

export type PageSectionType = (typeof PAGE_SECTION_TYPES)[number]

export const CORE_PAGE_SLUGS = [
  "home",
  "cancellation-policy",
  "privacy-policy",
  "terms",
  "cookies",
] as const

export type CorePageSlug = (typeof CORE_PAGE_SLUGS)[number]

export function isCorePageSlug(slug: string): boolean {
  return (CORE_PAGE_SLUGS as readonly string[]).includes(slug)
}

export type PageSection = {
  id: string
  type: PageSectionType
  /** Stable slot key used by frontend layouts (e.g. hero.heading). */
  key: string
  heading?: string
  body?: string
  src?: string
  alt?: string
  question?: string
  answer?: string
  level?: 1 | 2 | 3
  /** Lucide marketing icon id (e.g. headset, wallet). */
  icon?: string
}

export type PageContentRecord = {
  slug: string
  label: string
  title: string
  description: string
  ogImage: string
  sections: PageSection[]
  updatedAt?: string
  fromDatabase: boolean
  /** Locale of the loaded row (may be fallback). */
  locale?: string
  /** True when a DB row exists for the requested locale (not just EN fallback). */
  hasLocaleRow?: boolean
}

function newId() {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID()
  }
  return `sec_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

export function parseSections(value: unknown): PageSection[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .map((item) => {
      const type = PAGE_SECTION_TYPES.includes(item.type as PageSectionType)
        ? (item.type as PageSectionType)
        : "text"
      return {
        id: typeof item.id === "string" && item.id ? item.id : newId(),
        type,
        key: typeof item.key === "string" ? item.key : "",
        heading: typeof item.heading === "string" ? item.heading : undefined,
        body: typeof item.body === "string" ? item.body : undefined,
        src: typeof item.src === "string" ? item.src : undefined,
        alt: typeof item.alt === "string" ? item.alt : undefined,
        question: typeof item.question === "string" ? item.question : undefined,
        answer: typeof item.answer === "string" ? item.answer : undefined,
        level:
          item.level === 1 || item.level === 2 || item.level === 3
            ? item.level
            : undefined,
        icon: typeof item.icon === "string" ? item.icon : undefined,
      } satisfies PageSection
    })
}

export function sectionValue(
  sections: PageSection[],
  key: string,
  field: keyof PageSection = "body",
): string {
  const found = sections.find((s) => s.key === key)
  if (!found) return ""
  const value = found[field]
  return typeof value === "string" ? value : ""
}

export function sectionHeading(sections: PageSection[], key: string): string {
  return sectionValue(sections, key, "heading")
}

export function faqSections(sections: PageSection[]): PageSection[] {
  return sections.filter((s) => s.type === "faq_item")
}

function pickText(
  localized: string | undefined,
  fallback: string | undefined,
): string | undefined {
  const local = localized?.trim()
  if (local) return localized
  const base = fallback?.trim()
  if (base) return fallback
  return localized ?? fallback
}

/**
 * Merge a locale's sections onto English (or defaults). Empty translated
 * text/fields fall back to the English value so partial translations still
 * render a complete page.
 */
export function mergeLocalizedSections(
  localized: PageSection[],
  fallback: PageSection[],
): PageSection[] {
  if (localized.length === 0) return fallback
  if (fallback.length === 0) return localized

  const byKey = new Map(
    localized.filter((s) => s.key).map((s) => [s.key, s] as const),
  )
  const usedKeys = new Set<string>()

  const merged = fallback.map((base) => {
    const loc = base.key ? byKey.get(base.key) : undefined
    if (!loc) return { ...base }
    if (base.key) usedKeys.add(base.key)

    if (loc.type === "heading") {
      return {
        ...base,
        ...loc,
        id: loc.id || base.id,
        heading: pickText(loc.heading, base.heading),
        level: loc.level ?? base.level,
      }
    }
    if (loc.type === "text") {
      return {
        ...base,
        ...loc,
        id: loc.id || base.id,
        body: pickText(loc.body, base.body),
      }
    }
    if (loc.type === "image") {
      return {
        ...base,
        ...loc,
        id: loc.id || base.id,
        src: pickText(loc.src, base.src),
        alt: pickText(loc.alt, base.alt),
      }
    }
    if (loc.type === "faq_item") {
      return {
        ...base,
        ...loc,
        id: loc.id || base.id,
        question: pickText(loc.question, base.question),
        answer: pickText(loc.answer, base.answer),
      }
    }
    if (loc.type === "attraction") {
      return {
        ...base,
        ...loc,
        id: loc.id || base.id,
        heading: pickText(loc.heading, base.heading),
        body: pickText(loc.body, base.body),
        src: pickText(loc.src, base.src),
        alt: pickText(loc.alt, base.alt),
      }
    }
    return { ...base, ...loc, id: loc.id || base.id }
  })

  // Locale-only sections (new keys) that aren't in English yet.
  for (const loc of localized) {
    if (!loc.key || usedKeys.has(loc.key)) continue
    if (fallback.some((s) => s.key === loc.key)) continue
    merged.push({ ...loc })
  }

  return merged
}

export type DestinationAttraction = {
  id: string
  title: string
  description: string
  image: string
  imageAlt: string
}

export function attractionSections(sections: PageSection[]): PageSection[] {
  return sections.filter((s) => s.type === "attraction")
}

export function attractionsFromSections(
  sections: PageSection[],
): DestinationAttraction[] {
  return attractionSections(sections)
    .map((section) => ({
      id: section.id,
      title: section.heading?.trim() || "",
      description: section.body?.trim() || "",
      image: section.src?.trim() || "",
      imageAlt: section.alt?.trim() || section.heading?.trim() || "Attraction",
    }))
    .filter((item) => item.title || item.description || item.image)
}

export type HomeMarketingCopy = {
  hero: {
    heading: string
    text: string
    image: string
    imageAlt: string
  }
  whyBook: {
    heading: string
    items: { title: string; description: string; icon: string }[]
  }
  destinations: {
    heading: string
    text: string
  }
  testimonials: {
    eyebrow: string
    heading: string
  }
  peace: {
    eyebrow: string
    heading: string
    items: string[]
  }
  safety: {
    heading: string
    items: {
      title: string
      description: string
      image: string
      alt: string
    }[]
  }
  faq: PageSection[]
}

export function homeCopyFromSections(sections: PageSection[]): HomeMarketingCopy {
  return {
    hero: {
      heading:
        sectionHeading(sections, "hero.heading") ||
        "Arrive. Discover.\nExperience.",
      text:
        sectionValue(sections, "hero.text") ||
        "Personalised airport transfers designed for travel across Albania.",
      image:
        sectionValue(sections, "hero.image", "src") ||
        "https://www.welcomepickups.com/wp-content/themes/welcomepickups_new/images/conversion-v2/hero_photo_desktop_2.jpg",
      imageAlt: sectionValue(sections, "hero.image", "alt"),
    },
    whyBook: {
      heading:
        sectionHeading(sections, "whyBook.heading") || "Why book with us?",
      items: [1, 2, 3]
        .map((n) => ({
          title: sectionHeading(sections, `whyBook.item${n}.heading`),
          description: sectionValue(sections, `whyBook.item${n}.text`),
          icon: sectionValue(sections, `whyBook.item${n}.heading`, "icon"),
        }))
        .filter((item) => item.title || item.description),
    },
    destinations: {
      heading:
        sectionHeading(sections, "destinations.heading") ||
        "Featured Destinations",
      text: sectionValue(sections, "destinations.text"),
    },
    testimonials: {
      eyebrow:
        sectionValue(sections, "testimonials.eyebrow") || "Traveller stories",
      heading:
        sectionHeading(sections, "testimonials.heading") ||
        "Trusted by travellers across Albania",
    },
    peace: {
      eyebrow:
        sectionValue(sections, "peace.eyebrow") || "Absolute Peace of Mind",
      heading:
        sectionHeading(sections, "peace.heading") ||
        "Why Book with Albania Transfers",
      items: [1, 2, 3, 4, 5, 6]
        .map((n) => sectionHeading(sections, `peace.item${n}`))
        .filter(Boolean),
    },
    safety: {
      heading:
        sectionHeading(sections, "safety.heading") ||
        "Safety is our #1 priority",
      items: [1, 2]
        .map((n) => ({
          title: sectionHeading(sections, `safety.item${n}.heading`),
          description: sectionValue(sections, `safety.item${n}.text`),
          image: sectionValue(sections, `safety.item${n}.image`, "src"),
          alt: sectionValue(sections, `safety.item${n}.image`, "alt"),
        }))
        .filter((item) => item.title || item.description || item.image),
    },
    faq: faqSections(sections),
  }
}
